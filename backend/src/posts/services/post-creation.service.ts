import { Injectable, Logger } from "@nestjs/common";
import { Post } from "../entities/post.entity";
import { User } from "../../users/entities/user.entity";
import { File } from "../../files/entities/file.entity";
import { CreatePostDto } from "../dto/create-post.dto";
import { UpdatePostDto } from "../dto/update-post.dto";
import { PostCreator } from "./post-creator";
import { PostUpdater } from "./post-updater";
import { PostDeleter } from "./post-deleter";

/**
 * 포스트 생성/수정/삭제 Facade 서비스
 *
 * 이 클래스는 기존 Controller/API 계약을 유지하는 진입점 역할만 합니다.
 * 실제 비즈니스 로직은 PostCreator, PostUpdater, PostDeleter에 위임됩니다.
 *
 * ⚠️ 이 파일에 비즈니스 로직을 추가하지 마세요.
 * 새 기능은 해당 책임의 클래스(Creator/Updater/Deleter)에 구현하세요.
 */
@Injectable()
export class PostCreationService {
  private readonly logger = new Logger(PostCreationService.name);

  constructor(
    private readonly postCreator: PostCreator,
    private readonly postUpdater: PostUpdater,
    private readonly postDeleter: PostDeleter,
  ) {}

  // ─── 생성 (PostCreator 위임) ───────────────────────

  async create(
    createPostDto: CreatePostDto,
    author: User,
    files?: File[],
    ip?: string,
  ): Promise<Post> {
    return this.postCreator.create(createPostDto, author, files, ip);
  }

  async loadFilesByIds(fileIds: string[], userId: string): Promise<File[]> {
    return this.postCreator.loadFilesByIds(fileIds, userId);
  }

  async saveDraft(createPostDto: CreatePostDto, author: User): Promise<Post> {
    return this.postCreator.saveDraft(createPostDto, author);
  }

  // ─── 수정 (PostUpdater 위임) ───────────────────────

  async update(
    id: string,
    updatePostDto: UpdatePostDto,
    user: User,
    files?: File[],
  ): Promise<Post> {
    return this.postUpdater.update(id, updatePostDto, user, files);
  }

  async setEditorPick(
    postId: string,
    isEditorPick: boolean,
    user: User,
  ): Promise<void> {
    return this.postUpdater.setEditorPick(postId, isEditorPick, user);
  }

  async updateEditorPicksOrder(
    orderedIds: string[],
    user: User,
  ): Promise<void> {
    return this.postUpdater.updateEditorPicksOrder(orderedIds, user);
  }

  async setThumbnail(
    postId: string,
    userId: string,
    thumbnailFileId?: string,
  ): Promise<{ success: boolean; thumbnailUrl?: string }> {
    return this.postUpdater.setThumbnail(postId, userId, thumbnailFileId);
  }

  async rerenderContent(
    postId: string,
    user: User,
  ): Promise<{
    html: string;
    thumbnail: string | null;
  }> {
    return this.postUpdater.rerenderContent(postId, user);
  }

  // ─── 삭제/복원/발행 (PostDeleter 위임) ─────────────

  async delete(id: string, user: User): Promise<void> {
    return this.postDeleter.delete(id, user);
  }

  async restore(id: string, user: User): Promise<Post> {
    return this.postDeleter.restore(id, user);
  }

  async permanentDelete(id: string, user: User): Promise<void> {
    return this.postDeleter.permanentDelete(id, user);
  }

  async publish(id: string, user: User): Promise<Post> {
    return this.postDeleter.publish(id, user, (pid, dto, u) =>
      this.postUpdater.update(pid, dto, u),
    );
  }

  async unpublish(id: string, user: User): Promise<Post> {
    return this.postDeleter.unpublish(id, user, (pid, dto, u) =>
      this.postUpdater.update(pid, dto, u),
    );
  }
}
