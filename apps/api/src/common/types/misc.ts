export interface PaginationOptions {
	page?: number;
	limit?: number;
}

export interface PaginationInfo {
	skip: number;
	take: number;
	page: number;
}

export interface SortNesting {
	key: string;
	values: string[];
}

export interface SortObjectArg {
	sort?: string;
	nesting?: SortNesting[];
}
