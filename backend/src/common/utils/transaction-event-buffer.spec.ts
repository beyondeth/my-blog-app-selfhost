import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TransactionEventBuffer } from "./transaction-event-buffer";

describe("TransactionEventBuffer", () => {
  let buffer: TransactionEventBuffer;
  let mockEmitter: jest.Mocked<EventEmitter2>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    buffer = new TransactionEventBuffer();
    mockEmitter = {
      emit: jest.fn().mockReturnValue(true),
    } as any;
    mockLogger = {
      debug: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;
  });

  describe("add()", () => {
    it("이벤트를 버퍼에 추가하면 size가 증가한다", () => {
      expect(buffer.size).toBe(0);
      buffer.add("test.event", { id: "1" });
      expect(buffer.size).toBe(1);
      buffer.add("test.event2", { id: "2" });
      expect(buffer.size).toBe(2);
    });
  });

  describe("flush()", () => {
    it("버퍼에 쌓인 모든 이벤트를 발행한다", () => {
      buffer.add("event.a", { postId: "1" });
      buffer.add("event.b", { postId: "2" });

      buffer.flush(mockEmitter, mockLogger);

      expect(mockEmitter.emit).toHaveBeenCalledTimes(2);
      expect(mockEmitter.emit).toHaveBeenCalledWith("event.a", {
        postId: "1",
      });
      expect(mockEmitter.emit).toHaveBeenCalledWith("event.b", {
        postId: "2",
      });
    });

    it("flush 후 버퍼가 비워진다", () => {
      buffer.add("event.a", { postId: "1" });
      buffer.flush(mockEmitter, mockLogger);
      expect(buffer.size).toBe(0);
    });

    it("correlationId가 로그에 포함된다", () => {
      buffer.add("event.a", { postId: "1" });
      buffer.flush(mockEmitter, mockLogger, "req-123");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("correlationId=req-123"),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("correlationId=req-123"),
      );
    });

    it("correlationId 미제공 시 N/A로 로깅된다", () => {
      buffer.add("event.a", { postId: "1" });
      buffer.flush(mockEmitter, mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("correlationId=N/A"),
      );
    });

    it("개별 이벤트 emit 실패 시 예외를 전파하지 않고 다음 이벤트를 계속 처리한다", () => {
      mockEmitter.emit
        .mockImplementationOnce(() => {
          throw new Error("emit failed");
        })
        .mockReturnValueOnce(true);

      buffer.add("event.fail", { postId: "1" });
      buffer.add("event.success", { postId: "2" });

      // flush가 예외를 던지지 않아야 함
      expect(() => buffer.flush(mockEmitter, mockLogger)).not.toThrow();

      // 두 번째 이벤트는 정상 발행되어야 함
      expect(mockEmitter.emit).toHaveBeenCalledTimes(2);
      expect(mockEmitter.emit).toHaveBeenCalledWith("event.success", {
        postId: "2",
      });
    });

    it("실패 시 에러 로그를 남기고 성공/실패 카운터를 기록한다", () => {
      mockEmitter.emit.mockImplementationOnce(() => {
        throw new Error("emit failed");
      });

      buffer.add("event.fail", { postId: "1" });
      buffer.flush(mockEmitter, mockLogger, "req-456");

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("status=failed"),
        expect.any(String),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("success=0 failed=1"),
      );
    });

    it("빈 버퍼 flush 시 summary 로그를 남기지 않는다", () => {
      buffer.flush(mockEmitter, mockLogger);
      expect(mockLogger.log).not.toHaveBeenCalled();
    });
  });

  describe("clear()", () => {
    it("버퍼를 비우면 이벤트가 발행되지 않는다", () => {
      buffer.add("event.a", { postId: "1" });
      buffer.add("event.b", { postId: "2" });

      buffer.clear();

      expect(buffer.size).toBe(0);
      buffer.flush(mockEmitter, mockLogger);
      expect(mockEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
