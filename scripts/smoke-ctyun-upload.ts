/**
 * 冒烟：向天翼云桶写入一小张对象并设公共读
 * 用法：npx ts-node -r tsconfig-paths/register scripts/smoke-ctyun-upload.ts
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import {
  PutObjectAclCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

loadEnv({ path: resolve(__dirname, '../.env') });

async function main() {
  const accessKeyId = process.env.CTYUN_AK?.trim();
  const secretAccessKey = process.env.CTYUN_SK?.trim();
  const bucket = process.env.CTYUN_BUCKET?.trim() || 'bucket-220430';
  const endpoint =
    process.env.CTYUN_ENDPOINT?.trim() || 'https://huadong-1.ctyunzos.cn';
  const publicBase =
    process.env.CTYUN_PUBLIC_BASE?.trim() ||
    `https://${bucket}.huadong-1.ctyunzos.cn`;
  const region = process.env.CTYUN_REGION?.trim() || 'huadong-1';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('缺少 CTYUN_AK / CTYUN_SK');
  }

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: process.env.CTYUN_FORCE_PATH_STYLE === 'true',
  });

  const key = `users/smoke/test-${Date.now()}.txt`;
  const body = Buffer.from(`tapnow ctyun smoke ${new Date().toISOString()}\n`);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'text/plain; charset=utf-8',
      ACL: 'public-read',
    }),
  );

  const url = `${publicBase.replace(/\/$/, '')}/${key}`;
  console.log('uploaded:', url);

  const res = await fetch(url);
  console.log('GET status:', res.status);
  console.log('body:', (await res.text()).trim());
  if (!res.ok) {
    // ACL 可能未生效，再试一次 PutObjectAcl
    await client.send(
      new PutObjectAclCommand({
        Bucket: bucket,
        Key: key,
        ACL: 'public-read',
      }),
    );
    const retry = await fetch(url);
    console.log('GET after ACL:', retry.status, (await retry.text()).trim());
    if (!retry.ok) process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
