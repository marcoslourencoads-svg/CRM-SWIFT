import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';

export const USE_API_KEY = 'useApiKey';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const useApiKey = this.reflector.getAllAndOverride<boolean>(USE_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!useApiKey) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    const validKey = await this.apiKeysService.validateKey(apiKey);

    if (!validKey) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    // Attach org info to request so downstream code can use it
    request.apiKey = validKey;
    request.user = {
      sub: validKey.createdBy,
      orgId: validKey.organizationId,
      role: 'API',
    };

    return true;
  }
}
