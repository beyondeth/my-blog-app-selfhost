/**
 * Repository Mock Utilities
 * Provides mock implementations for TypeORM repositories
 */

import { FindOperator, SelectQueryBuilder } from "typeorm";

function matchesLike(value: unknown, pattern: unknown): boolean {
  if (typeof value !== "string" || typeof pattern !== "string") return false;
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `^${escaped.replace(/%/g, ".*").replace(/_/g, ".")}$`,
  );
  return regex.test(value);
}

function matchesValue(actual: unknown, expected: unknown): boolean {
  if (expected instanceof FindOperator) {
    switch (expected.type) {
      case "isNull":
        return actual === null || actual === undefined;
      case "lessThan":
        return (
          actual !== null && actual !== undefined && actual < expected.value
        );
      case "moreThan":
        return (
          actual !== null && actual !== undefined && actual > expected.value
        );
      case "like":
        return matchesLike(actual, expected.value);
      case "not":
        return !matchesValue(actual, expected.child || expected.value);
      case "in":
        return Array.isArray(expected.value) && expected.value.includes(actual);
      default:
        return actual === expected.value;
    }
  }

  if (
    expected &&
    typeof expected === "object" &&
    !Array.isArray(expected) &&
    !(expected instanceof Date)
  ) {
    return matchesWhere(actual, expected as Record<string, unknown>);
  }

  return actual === expected;
}

function matchesWhere(item: unknown, where: Record<string, unknown>): boolean {
  if (!item || typeof item !== "object") return false;
  return Object.entries(where).every(([key, value]) =>
    matchesValue((item as Record<string, unknown>)[key], value),
  );
}

function fieldName(expression: string): string {
  return expression.trim().split(".").pop() as string;
}

export class MockRepository<T> {
  private data: T[] = [];
  private nextId = 1;

  constructor(initialData?: T[]) {
    if (initialData) {
      this.data = [...initialData];
    }
  }

  find = jest.fn().mockImplementation((options?: any) => {
    let result = [...this.data];

    if (options?.where) {
      result = result.filter((item) => matchesWhere(item, options.where));
    }

    if (options?.order) {
      const [key, direction] = Object.entries(options.order)[0] as [
        string,
        "ASC" | "DESC",
      ];
      result.sort((left, right) => {
        const leftValue = (left as any)[key];
        const rightValue = (right as any)[key];
        const comparison =
          leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
        return direction === "DESC" ? -comparison : comparison;
      });
    }

    const start = options?.skip || 0;
    const end = options?.take ? start + options.take : undefined;
    return Promise.resolve(result.slice(start, end));
  });

  findOne = jest.fn().mockImplementation((options: any) => {
    if (options.where) {
      const found = this.data.find((item) => matchesWhere(item, options.where));
      return Promise.resolve(found || null);
    }
    return Promise.resolve(this.data[0] || null);
  });

  create = jest.fn().mockImplementation((entity: Partial<T>) => {
    const created = { ...entity } as T & { id?: string };
    if (!created.id) created.id = `mock-${this.nextId++}`;
    return created;
  });

  save = jest.fn().mockImplementation((entity: T | T[]) => {
    if (Array.isArray(entity)) {
      entity.forEach((e) => this.addOrUpdate(e));
      return Promise.resolve(entity);
    }
    this.addOrUpdate(entity);
    return Promise.resolve(entity);
  });

  update = jest.fn().mockImplementation((criteria: any, updates: any) => {
    const items = this.data.filter((item) => {
      if (typeof criteria === "object") {
        return matchesWhere(item, criteria);
      }
      return (item as any).id === criteria;
    });

    items.forEach((item) => {
      Object.assign(item, updates);
    });

    return Promise.resolve({ affected: items.length });
  });

  remove = jest.fn().mockImplementation((entity: T | T[]) => {
    if (Array.isArray(entity)) {
      entity.forEach((e) => this.removeItem(e));
      return Promise.resolve(entity);
    }
    this.removeItem(entity);
    return Promise.resolve(entity);
  });

  delete = jest.fn().mockImplementation((criteria: any) => {
    const initialLength = this.data.length;
    this.data = this.data.filter((item) => {
      if (typeof criteria === "object") {
        return !matchesWhere(item, criteria);
      }
      return (item as any).id !== criteria;
    });

    return Promise.resolve({ affected: initialLength - this.data.length });
  });

  count = jest.fn().mockImplementation((options?: any) => {
    if (!options || !options.where) {
      return Promise.resolve(this.data.length);
    }

    const filtered = this.data.filter((item) =>
      matchesWhere(item, options.where),
    );

    return Promise.resolve(filtered.length);
  });

  createQueryBuilder = jest.fn().mockImplementation((alias?: string) => {
    return new MockQueryBuilder<T>(this.data, alias);
  });

  query = jest.fn().mockResolvedValue([]);

  // Helper methods
  private addOrUpdate(entity: T) {
    const index = this.data.findIndex(
      (item) => (item as any).id === (entity as any).id,
    );

    if (index >= 0) {
      this.data[index] = entity;
    } else {
      this.data.push(entity);
    }
  }

  private removeItem(entity: T) {
    const index = this.data.findIndex(
      (item) => (item as any).id === (entity as any).id,
    );

    if (index >= 0) {
      this.data.splice(index, 1);
    }
  }

  // Test utilities
  getData(): T[] {
    return [...this.data];
  }

  setData(data: T[]) {
    this.data = [...data];
  }

  clear() {
    this.data = [];
    this.nextId = 1;
    this.find.mockClear();
    this.findOne.mockClear();
    this.create.mockClear();
    this.save.mockClear();
    this.update.mockClear();
    this.remove.mockClear();
    this.delete.mockClear();
    this.count.mockClear();
    this.createQueryBuilder.mockClear();
    this.query.mockClear();
  }
}

/**
 * Mock Query Builder for TypeORM
 */
export class MockQueryBuilder<T> implements Partial<SelectQueryBuilder<T>> {
  private data: T[];
  private whereConditions: any[] = [];
  private selectFields: Array<{ expression: string; alias?: string }> = [];
  private limitValue?: number;
  private orderByField?: string;
  private orderByDirection?: "ASC" | "DESC";
  private groupByField?: string;
  private havingCondition?: string;
  public alias?: string;

  constructor(data: T[], alias?: string) {
    this.data = [...data];
    this.alias = alias;
  }

  select = jest
    .fn()
    .mockImplementation((fields: string | string[], alias?: string) => {
      if (Array.isArray(fields)) {
        this.selectFields.push(...fields.map((expression) => ({ expression })));
      } else {
        this.selectFields.push({ expression: fields, alias });
      }
      return this;
    });

  addSelect = jest.fn().mockImplementation((field: string, alias?: string) => {
    this.selectFields.push({ expression: field, alias });
    return this;
  });

  where = jest.fn().mockImplementation((condition: string, params?: any) => {
    this.whereConditions.push({ condition, params });
    return this;
  });

  andWhere = jest.fn().mockImplementation((condition: string, params?: any) => {
    this.whereConditions.push({ condition, params, operator: "AND" });
    return this;
  });

  orWhere = jest.fn().mockImplementation((condition: string, params?: any) => {
    this.whereConditions.push({ condition, params, operator: "OR" });
    return this;
  });

  leftJoin = jest.fn().mockImplementation(() => this);
  leftJoinAndSelect = jest.fn().mockImplementation(() => this);
  innerJoin = jest.fn().mockImplementation(() => this);
  innerJoinAndSelect = jest.fn().mockImplementation(() => this);

  orderBy = jest
    .fn()
    .mockImplementation((field: string, direction?: "ASC" | "DESC") => {
      this.orderByField = field;
      this.orderByDirection = direction || "ASC";
      return this;
    });

  limit = jest.fn().mockImplementation((limit: number) => {
    this.limitValue = limit;
    return this;
  });

  offset = jest.fn().mockImplementation(() => this);
  skip = jest.fn().mockImplementation(() => this);
  take = jest.fn().mockImplementation((take: number) => {
    this.limitValue = take;
    return this;
  });

  groupBy = jest.fn().mockImplementation((field: string) => {
    this.groupByField = field;
    return this;
  });
  having = jest.fn().mockImplementation((condition: string) => {
    this.havingCondition = condition;
    return this;
  });

  private getFilteredData(): T[] {
    let result = [...this.data];

    for (const { condition, params } of this.whereConditions) {
      result = result.filter((item) =>
        this.matchesCondition(item, condition, params),
      );
    }

    if (this.orderByField && !this.groupByField) {
      const key = fieldName(this.orderByField);
      result.sort((left, right) => {
        const leftValue = (left as any)[key];
        const rightValue = (right as any)[key];
        const comparison =
          leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
        return this.orderByDirection === "DESC" ? -comparison : comparison;
      });
    }

    if (this.limitValue) result = result.slice(0, this.limitValue);
    return result;
  }

  private matchesCondition(item: T, condition: string, params?: any): boolean {
    const normalized = condition.replace(/\s+/g, " ").trim();
    const nullMatch = normalized.match(/(?:\w+\.)?(\w+) IS (NOT )?NULL/i);
    if (nullMatch) {
      const value = (item as any)[nullMatch[1]];
      return nullMatch[2]
        ? value !== null && value !== undefined
        : value == null;
    }

    const booleanMatch = normalized.match(/(?:\w+\.)?(\w+) = (true|false)/i);
    if (booleanMatch) {
      return (item as any)[booleanMatch[1]] === (booleanMatch[2] === "true");
    }

    const comparisonMatch = normalized.match(
      /(?:\w+\.)?(\w+)\s*(NOT LIKE|LIKE|!=|=|<|>)\s*:(\w+)/i,
    );
    if (!comparisonMatch) return true;

    const actual = (item as any)[comparisonMatch[1]];
    const expected = params?.[comparisonMatch[3]];
    switch (comparisonMatch[2].toUpperCase()) {
      case "LIKE":
        return matchesLike(actual, expected);
      case "NOT LIKE":
        return !matchesLike(actual, expected);
      case "!=":
        return actual !== expected;
      case "=":
        return actual === expected;
      case "<":
        return actual < expected;
      case ">":
        return actual > expected;
      default:
        return true;
    }
  }

  getMany = jest.fn().mockImplementation(() => {
    return Promise.resolve(this.getFilteredData());
  });

  getOne = jest.fn().mockImplementation(() => {
    return this.getMany().then((results) => results[0] || null);
  });

  getCount = jest.fn().mockImplementation(() => {
    return this.getMany().then((results) => results.length);
  });

  getRawMany = jest.fn().mockImplementation(() => {
    const data = this.getFilteredData();
    if (!this.groupByField) return Promise.resolve(data);

    const groupKey = fieldName(this.groupByField);
    const groups = new Map<unknown, T[]>();
    for (const item of data) {
      const key = (item as any)[groupKey];
      groups.set(key, [...(groups.get(key) || []), item]);
    }

    let rows = [...groups.entries()].map(([key, items]) => {
      const row: Record<string, unknown> = {};
      for (const { expression, alias } of this.selectFields) {
        const outputKey = alias || fieldName(expression);
        if (/^COUNT\(\*\)$/i.test(expression)) row[outputKey] = items.length;
        else if (/^SUM\(/i.test(expression)) {
          const sumKey = fieldName(expression.replace(/[()]/g, ""));
          row[outputKey] = items.reduce(
            (total, item) => total + Number((item as any)[sumKey] || 0),
            0,
          );
        } else if (/^GROUP_CONCAT\(/i.test(expression)) {
          const idKey = fieldName(expression.replace(/[()]/g, ""));
          row[outputKey] = items.map((item) => (item as any)[idKey]).join(",");
        } else {
          row[outputKey] = key;
        }
      }
      return row;
    });

    if (this.havingCondition?.match(/COUNT\(\*\) > 1/i)) {
      const countAlias = this.selectFields.find(({ expression }) =>
        /^COUNT\(\*\)$/i.test(expression),
      )?.alias;
      if (countAlias) rows = rows.filter((row) => Number(row[countAlias]) > 1);
    }

    if (this.orderByField) {
      const selected = this.selectFields.find(
        ({ expression, alias }) =>
          expression === this.orderByField || alias === this.orderByField,
      );
      const key = selected?.alias || fieldName(this.orderByField);
      rows.sort((left, right) => {
        const comparison = Number(left[key]) - Number(right[key]);
        return this.orderByDirection === "DESC" ? -comparison : comparison;
      });
    }

    if (this.limitValue) rows = rows.slice(0, this.limitValue);
    return Promise.resolve(rows);
  });

  getRawOne = jest.fn().mockImplementation(() => {
    const data = this.getFilteredData();
    const row: Record<string, unknown> = {};
    for (const { expression, alias } of this.selectFields) {
      const outputKey = alias || fieldName(expression);
      if (/^COUNT\(\*\)$/i.test(expression)) row[outputKey] = data.length;
      else if (/^SUM\(/i.test(expression)) {
        const sumKey = fieldName(expression.replace(/[()]/g, ""));
        row[outputKey] = data.reduce(
          (total, item) => total + Number((item as any)[sumKey] || 0),
          0,
        );
      } else {
        row[outputKey] = data[0]
          ? (data[0] as any)[fieldName(expression)]
          : null;
      }
    }
    return Promise.resolve(row);
  });

  getManyAndCount = jest.fn().mockImplementation(() => {
    return this.getMany().then(
      (results) => [results, results.length] as [T[], number],
    );
  });

  // Test utilities
  getWhereConditions() {
    return this.whereConditions;
  }

  getSelectFields() {
    return this.selectFields.map(({ expression }) => expression);
  }
}
