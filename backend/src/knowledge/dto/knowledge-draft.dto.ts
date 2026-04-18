import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { KNOWLEDGE_NODE_TYPES, KNOWLEDGE_RELATION_TYPES } from "../knowledge.constants";

class KnowledgeDraftNodeDto {
  @IsString()
  @MaxLength(200)
  label: string;

  @IsOptional()
  @IsIn(KNOWLEDGE_NODE_TYPES)
  nodeType?: (typeof KNOWLEDGE_NODE_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  summary?: string | null;

  @IsOptional()
  @IsNumber()
  confidence?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceRefs?: string[];
}

class KnowledgeDraftEdgeDto {
  @IsString()
  @MaxLength(200)
  fromLabel: string;

  @IsString()
  @MaxLength(200)
  toLabel: string;

  @IsIn(KNOWLEDGE_RELATION_TYPES)
  relation: (typeof KNOWLEDGE_RELATION_TYPES)[number];

  @IsOptional()
  @IsNumber()
  confidence?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  reason?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceRefs?: string[];
}

export class SubmitKnowledgeDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  rootLabel?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KnowledgeDraftNodeDto)
  nodes?: KnowledgeDraftNodeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KnowledgeDraftEdgeDto)
  edges?: KnowledgeDraftEdgeDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];
}
