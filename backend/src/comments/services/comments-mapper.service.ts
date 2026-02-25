import { Injectable, Logger } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { Comment } from "../entities/comment.entity";
import { CommentResponseDto } from "../dto/comment-response.dto";
import { UserResponseDto } from "../../users/dto/user-response.dto";
import { CdnService } from "../../files/services/cdn.service";

@Injectable()
export class CommentsMapperService {
  private readonly logger = new Logger(CommentsMapperService.name);

  constructor(private readonly cdnService: CdnService) {}

  /**
   * Comment Entity를 CommentResponseDto로 변환
   */
  toCommentDto(
    comment: Comment,
    additionalData?: Partial<CommentResponseDto>,
  ): CommentResponseDto {
    const dto = plainToInstance(CommentResponseDto, comment, {
      excludeExtraneousValues: true,
    });

    if (comment.author) {
      let profileImage: string | null = null;

      if (comment.author instanceof UserResponseDto) {
        dto.author = comment.author;
      } else {
        if (comment.author.profile) {
          profileImage = comment.author.profile.profileImage;
        }
        if (profileImage) {
          if (
            profileImage.startsWith("v2/") ||
            profileImage.startsWith("uploads/")
          ) {
            profileImage = this.cdnService.generateCdnUrlFromKey(profileImage);
          }
        }

        dto.author = plainToInstance(UserResponseDto, {
          ...comment.author,
          profileImage: profileImage,
        });
      }
    }

    if (additionalData) {
      Object.assign(dto, additionalData);
    }

    return dto;
  }
}
