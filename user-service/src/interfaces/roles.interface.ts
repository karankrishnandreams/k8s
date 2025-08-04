export interface ISubPermission {
    name: string;
    key_value?: string;
}

export interface IPermission {
    name: string;
    key_value?: string;
    domain?: string; 
    sub_modules?: ISubPermission[];
}

export interface IRole {
    role_name: string; 
    role_description : string ; 
    key_value?: string;
    modules?: IPermission[];
    isdefaultRole?: boolean;
    status?: 'active' | 'inactive';
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date | null;
    isPermissionAssigned: boolean;
}