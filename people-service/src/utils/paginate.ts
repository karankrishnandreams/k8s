import { Model, FilterQuery } from 'mongoose';

interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

interface AggregatePaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: "asc" | "desc";
}


export const paginate = async <T>(
  model: Model<T>,
  filter: FilterQuery<T> = {},
  options: PaginationOptions = {},
  projection: any = {},
) => {
  const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = options;

  const skip = (page - 1) * limit;
  const sortDirection = order === 'asc' ? 1 : -1;

  const [results, total] = await Promise.all([
    model
      .find(filter, projection)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit)
      .lean(),
    model.countDocuments(filter),
  ]);
  return {
    data: results,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};


export const paginateAggregate = async (
  model: Model<any>,
  pipeline: any[] = [],
  options: AggregatePaginationOptions = {}
) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "desc",
  } = options;

  const skip = (page - 1) * limit;
  const sortDirection = order === "asc" ? 1 : -1;

  const paginatedPipeline = [
    ...pipeline,
    { $sort: { [sortBy]: sortDirection } },
    { $skip: skip },
    { $limit: limit },
  ];

  const countPipeline = [...pipeline, { $count: "total" }];

  const [data, countResult] = await Promise.all([
    model.aggregate(paginatedPipeline).exec(),
    model.aggregate(countPipeline).exec(),
  ]);

  const total = countResult[0]?.total || 0;

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};
