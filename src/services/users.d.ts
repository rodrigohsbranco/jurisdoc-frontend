export type User = {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    is_admin: boolean;
    is_active: boolean;
};
export type Paginated<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};
export declare function listUsers(params: {
    page?: number;
    page_size?: number;
    search?: string;
    ordering?: string;
}): Promise<Paginated<User>>;
export declare function createUser(payload: User & {
    password: string;
}): Promise<User>;
export declare function updateUser(id: number, payload: Partial<User> & {
    password?: string;
}): Promise<User>;
export declare function deleteUser(id: number): Promise<void>;
export declare function setUserPassword(id: number, new_password: string): Promise<void>;
