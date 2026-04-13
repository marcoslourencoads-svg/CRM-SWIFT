import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class OrgContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    // orgId comes from JWT payload (set by JwtAuthGuard)
    // or can be overridden via X-Organization-Id header for multi-org users
    const headerOrgId = req.headers['x-organization-id'] as string;
    if (headerOrgId && (req as any).user) {
      (req as any).user.orgId = headerOrgId;
    }
    next();
  }
}
