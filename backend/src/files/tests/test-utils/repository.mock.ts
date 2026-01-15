/**
 * Repository Mock Utilities
 * Provides mock implementations for TypeORM repositories
 */

import { SelectQueryBuilder } from "typeorm";

export class MockRepository<T> {
  private data: T[] = [];

  constructor(initialData?: T[]) {
    if (initialData) {
      this.data = [...initialData];
    }
  }

  find = jest.fn().mockImplementation((options?: any) => {
    if (!options) return Promise.resolve(this.data);

    // Simple where clause simulation
    if (options.where) {
      const filtered = this.data.filter((item) => {
        return Object.entries(options.where).every(([key, value]) => {
          return (item as any)[key] === value;
        });
      });
      return Promise.resolve(filtered);
    }

    return Promise.resolve(this.data);
  });

  findOne = jest.fn().mockImplementation((options: any) => {
    if (options.where) {
      const found = this.data.find((item) => {
        return Object.entries(options.where).every(([key, value]) => {
          return (item as any)[key] === value;
        });
      });
      return Promise.resolve(found || null);
    }
    return Promise.resolve(this.data[0] || null);
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
        return Object.entries(criteria).every(([key, value]) => {
          return (item as any)[key] === value;
        });
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
        return !Object.entries(criteria).every(([key, value]) => {
          return (item as any)[key] === value;
        });
      }
      return (item as any).id !== criteria;
    });

    return Promise.resolve({ affected: initialLength - this.data.length });
  });

  count = jest.fn().mockImplementation((options?: any) => {
    if (!options || !options.where) {
      return Promise.resolve(this.data.length);
    }

    const filtered = this.data.filter((item) => {
      return Object.entries(options.where).every(([key, value]) => {
        return (item as any)[key] === value;
      });
    });

    return Promise.resolve(filtered.length);
  });

  createQueryBuilder = jest.fn().mockImplementation((alias?: string) => {
    return new MockQueryBuilder<T>(this.data, alias);
  });

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
    this.find.mockClear();
    this.findOne.mockClear();
    this.save.mockClear();
    this.update.mockClear();
    this.remove.mockClear();
    this.delete.mockClear();
    this.count.mockClear();
    this.createQueryBuilder.mockClear();
  }
}

/**
 * Mock Query Builder for TypeORM
 */
export class MockQueryBuilder<T> implements Partial<SelectQueryBuilder<T>> {
  private data: T[];
  private whereConditions: any[] = [];
  private selectFields: string[] = [];
  private limitValue?: number;
  private orderByField?: string;
  private orderByDirection?: "ASC" | "DESC";
  public alias?: string;

  constructor(data: T[], alias?: string) {
    this.data = [...data];
    this.alias = alias;
  }

  select = jest.fn().mockImplementation((fields: string | string[]) => {
    if (Array.isArray(fields)) {
      this.selectFields.push(...fields);
    } else {
      this.selectFields.push(fields);
    }
    return this;
  });

  addSelect = jest.fn().mockImplementation((field: string) => {
    this.selectFields.push(field);
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

  groupBy = jest.fn().mockImplementation(() => this);
  having = jest.fn().mockImplementation(() => this);

  getMany = jest.fn().mockImplementation(() => {
    let result = [...this.data];

    // Apply simple filtering based on where conditions
    if (this.whereConditions.length > 0) {
      // Simplified filtering logic
      result = result.filter((item) => {
        // Mock implementation - in real tests, you'd implement proper filtering
        return true;
      });
    }

    // Apply limit
    if (this.limitValue) {
      result = result.slice(0, this.limitValue);
    }

    return Promise.resolve(result);
  });

  getOne = jest.fn().mockImplementation(() => {
    return this.getMany().then((results) => results[0] || null);
  });

  getCount = jest.fn().mockImplementation(() => {
    return this.getMany().then((results) => results.length);
  });

  getRawMany = jest.fn().mockImplementation(() => {
    return this.getMany();
  });

  getRawOne = jest.fn().mockImplementation(() => {
    return this.getOne();
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
    return this.selectFields;
  }
}
