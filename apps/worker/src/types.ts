export interface PaginationOptions {
	page?: number | undefined;
	limit?: number | undefined;
}

export interface PaginationInfo {
	skip: number;
	take: number;
	page: number;
}

export interface PaginationMetaData {
	total: number;
	pageSize: number;
	currentPage: number;
	lastPage: number;
}

export interface Paginated<T> extends PaginationMetaData {
	list: T[];
}

export type RawValue = string | number | null | undefined;
