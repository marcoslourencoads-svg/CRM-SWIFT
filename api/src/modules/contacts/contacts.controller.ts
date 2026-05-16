import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsEmail, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ContactsService } from './contacts.service';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';

class ContactDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  jobTitle?: string;

  @IsString()
  @IsOptional()
  companyId?: string;
}

class CompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  domain?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  website?: string;
}

@Controller()
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  // ---------- Contacts ----------

  @Get('contacts')
  listContacts(
    @CurrentOrg() orgId: string,
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.listContacts(orgId, search, companyId);
  }

  @Get('contacts/:id')
  getContact(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.getContact(orgId, id);
  }

  @Post('contacts')
  createContact(@CurrentOrg() orgId: string, @Body() dto: ContactDto) {
    return this.service.createContact(orgId, dto);
  }

  @Patch('contacts/:id')
  updateContact(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: ContactDto,
  ) {
    return this.service.updateContact(orgId, id, dto);
  }

  @Delete('contacts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContact(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.removeContact(orgId, id);
  }

  // ---------- Companies ----------

  @Get('companies')
  listCompanies(@CurrentOrg() orgId: string, @Query('search') search?: string) {
    return this.service.listCompanies(orgId, search);
  }

  @Get('companies/:id')
  getCompany(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.getCompany(orgId, id);
  }

  @Post('companies')
  createCompany(@CurrentOrg() orgId: string, @Body() dto: CompanyDto) {
    return this.service.createCompany(orgId, dto);
  }

  @Patch('companies/:id')
  updateCompany(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: CompanyDto,
  ) {
    return this.service.updateCompany(orgId, id, dto);
  }

  @Delete('companies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCompany(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.removeCompany(orgId, id);
  }
}
