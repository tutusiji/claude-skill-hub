import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { addSubmission, UPLOAD_DIR } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const name = formData.get('name') as string;
    const employeeId = formData.get('employeeId') as string;
    const email = formData.get('email') as string;
    const department = formData.get('department') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const file = formData.get('file') as File;

    // Validate required fields
    const missing: string[] = [];
    if (!name?.trim()) missing.push('姓名');
    if (!employeeId?.trim()) missing.push('工号');
    if (!email?.trim()) missing.push('邮箱');
    if (!department?.trim()) missing.push('部门');
    if (!description?.trim()) missing.push('文件描述');
    if (!category?.trim()) missing.push('插件分类');
    if (!file || file.size === 0) missing.push('上传文件');

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `以下字段为必填项：${missing.join('、')}` },
        { status: 400 }
      );
    }

    // Save file
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const savedFilename = `${timestamp}-${safeFilename}`;
    const filepath = join(UPLOAD_DIR, savedFilename);

    mkdirSync(UPLOAD_DIR, { recursive: true });
    const arrayBuffer = await file.arrayBuffer();
    writeFileSync(filepath, Buffer.from(arrayBuffer));

    // Save submission metadata
    const id = `sub_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    addSubmission({
      id,
      name: name.trim(),
      employeeId: employeeId.trim(),
      email: email.trim(),
      department: department.trim(),
      description: description.trim(),
      category: category.trim(),
      filename: file.name,
      filepath: savedFilename,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: '提交成功！管理员将在审核后处理您的插件。',
      id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json(
      { error: `上传失败：${message}` },
      { status: 500 }
    );
  }
}
