import { DataSource } from "typeorm";

/**
 * 트랜잭션 데코레이터
 * 메서드 실행을 트랜잭션으로 감싸서 원자성을 보장합니다.
 *
 * @example
 * ```typescript
 * @Transactional()
 * async createPostWithFiles(data: CreatePostDto) {
 *   // 이 메서드 내의 모든 DB 작업이 하나의 트랜잭션으로 처리됨
 *   const post = await this.postsRepository.save(data);
 *   await this.filesRepository.save(files);
 *   return post;
 * }
 * ```
 */
export function Transactional() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // DataSource를 서비스에서 가져옴
      const dataSource: DataSource =
        this.dataSource ||
        this.repository?.manager.connection ||
        this.postsRepository?.manager.connection ||
        this.commentsRepository?.manager.connection;

      if (!dataSource) {
        throw new Error(
          "DataSource not found in service. Please inject it in the constructor.",
        );
      }

      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 원래 메서드의 this 컨텍스트를 queryRunner로 바인딩
        const originalRepositories: any = {};

        // 모든 repository를 queryRunner의 manager로 교체
        for (const key of Object.keys(this)) {
          if (key.endsWith("Repository") && this[key]?.manager) {
            originalRepositories[key] = this[key];
            this[key] = queryRunner.manager.getRepository(this[key].target);
          }
        }

        const result = await originalMethod.apply(this, args);

        await queryRunner.commitTransaction();

        // 원래 repository 복원
        for (const key of Object.keys(originalRepositories)) {
          this[key] = originalRepositories[key];
        }

        return result;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    };

    return descriptor;
  };
}

/**
 * 재시도 가능한 트랜잭션 데코레이터
 * 동시성 충돌 시 자동으로 재시도합니다.
 *
 * @param maxRetries 최대 재시도 횟수 (기본: 3)
 * @param retryDelay 재시도 간 대기 시간(ms) (기본: 100)
 */
export function RetryableTransaction(
  maxRetries: number = 3,
  retryDelay: number = 100,
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: any;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Transactional 데코레이터와 동일한 로직
          const dataSource: DataSource =
            this.dataSource ||
            this.repository?.manager.connection ||
            this.postsRepository?.manager.connection ||
            this.commentsRepository?.manager.connection;

          if (!dataSource) {
            throw new Error("DataSource not found in service.");
          }

          const queryRunner = dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            const originalRepositories: any = {};

            for (const key of Object.keys(this)) {
              if (key.endsWith("Repository") && this[key]?.manager) {
                originalRepositories[key] = this[key];
                this[key] = queryRunner.manager.getRepository(this[key].target);
              }
            }

            const result = await originalMethod.apply(this, args);

            await queryRunner.commitTransaction();

            for (const key of Object.keys(originalRepositories)) {
              this[key] = originalRepositories[key];
            }

            return result;
          } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
          } finally {
            await queryRunner.release();
          }
        } catch (error) {
          lastError = error;

          // 동시성 충돌 에러인 경우에만 재시도
          if (
            attempt < maxRetries &&
            (error.message?.includes("could not serialize access") ||
              error.message?.includes("deadlock detected") ||
              error.code === "40001" || // serialization_failure
              error.code === "40P01") // deadlock_detected
          ) {
            // 지수 백오프로 대기
            await new Promise((resolve) =>
              setTimeout(resolve, retryDelay * attempt),
            );
            continue;
          }

          throw error;
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}
