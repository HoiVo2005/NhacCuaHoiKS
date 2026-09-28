import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { ApiError } from "@/types";

import { isServiceError } from "./errors";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

function errorResponse(status: number, error: string, details?: unknown) {
  const body: ApiError = { error };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

export function badRequest(error = "Dữ liệu không hợp lệ", details?: unknown) {
  return errorResponse(400, error, details);
}

export function unauthorized(error = "Bạn cần đăng nhập để thực hiện thao tác này") {
  return errorResponse(401, error);
}

export function forbidden(error = "Bạn không có quyền thực hiện thao tác này") {
  return errorResponse(403, error);
}

export function notFound(error = "Không tìm thấy dữ liệu") {
  return errorResponse(404, error);
}

export function conflict(error = "Dữ liệu đã tồn tại") {
  return errorResponse(409, error);
}

export function unprocessable(error = "Dữ liệu không hợp lệ", details?: unknown) {
  return errorResponse(422, error, details);
}

export function tooManyRequests(error = "Bạn thao tác quá nhanh, vui lòng thử lại sau") {
  return errorResponse(429, error);
}

export function serverError(error: unknown, message = "Lỗi hệ thống, vui lòng thử lại sau") {
  console.error("[api]", error);
  return errorResponse(500, message);
}

/**
 * Chuan hoa loi Zod thanh danh sach loi theo tung truong
 */
export function fromZodError(error: ZodError) {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    if (!details[path]) details[path] = issue.message;
  }
  return unprocessable("Dữ liệu không hợp lệ", details);
}

/**
 * Boc handler API de tu dong bat loi khong mong doi
 */
export function handleApi<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
) {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        return fromZodError(error);
      }
      if (isServiceError(error)) {
        return errorResponse(error.status, error.message, error.details);
      }
      return serverError(error);
    }
  };
}
