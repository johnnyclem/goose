// This file is auto-generated by @hey-api/openapi-ts

import type { Options as ClientOptions, TDataShape, Client } from '@hey-api/client-fetch';
import type { ReadAllConfigData, ReadAllConfigResponse, RemoveExtensionData, RemoveExtensionResponse, AddExtensionData, AddExtensionResponse, UpdateExtensionData, UpdateExtensionResponse, ProvidersData, ProvidersResponse2, ReadConfigData, RemoveConfigData, RemoveConfigResponse, UpsertConfigData, UpsertConfigResponse } from './types.gen';
import { client as _heyApiClient } from './client.gen';

export type Options<TData extends TDataShape = TDataShape, ThrowOnError extends boolean = boolean> = ClientOptions<TData, ThrowOnError> & {
    /**
     * You can provide a client instance returned by `createClient()` instead of
     * individual options. This might be also useful if you want to implement a
     * custom client.
     */
    client?: Client;
    /**
     * You can pass arbitrary values through the `meta` object. This can be
     * used to access values that aren't defined as part of the SDK function.
     */
    meta?: Record<string, unknown>;
};

export const readAllConfig = <ThrowOnError extends boolean = false>(options?: Options<ReadAllConfigData, ThrowOnError>) => {
    return (options?.client ?? _heyApiClient).get<ReadAllConfigResponse, unknown, ThrowOnError>({
        url: '/config',
        ...options
    });
};

export const removeExtension = <ThrowOnError extends boolean = false>(options: Options<RemoveExtensionData, ThrowOnError>) => {
    return (options.client ?? _heyApiClient).delete<RemoveExtensionResponse, unknown, ThrowOnError>({
        url: '/config/extension',
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers
        }
    });
};

export const addExtension = <ThrowOnError extends boolean = false>(options: Options<AddExtensionData, ThrowOnError>) => {
    return (options.client ?? _heyApiClient).post<AddExtensionResponse, unknown, ThrowOnError>({
        url: '/config/extension',
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers
        }
    });
};

export const updateExtension = <ThrowOnError extends boolean = false>(options: Options<UpdateExtensionData, ThrowOnError>) => {
    return (options.client ?? _heyApiClient).put<UpdateExtensionResponse, unknown, ThrowOnError>({
        url: '/config/extension',
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers
        }
    });
};

export const providers = <ThrowOnError extends boolean = false>(options?: Options<ProvidersData, ThrowOnError>) => {
    return (options?.client ?? _heyApiClient).get<ProvidersResponse2, unknown, ThrowOnError>({
        url: '/config/providers',
        ...options
    });
};

export const readConfig = <ThrowOnError extends boolean = false>(options: Options<ReadConfigData, ThrowOnError>) => {
    return (options.client ?? _heyApiClient).post<unknown, unknown, ThrowOnError>({
        url: '/config/read',
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers
        }
    });
};

export const removeConfig = <ThrowOnError extends boolean = false>(options: Options<RemoveConfigData, ThrowOnError>) => {
    return (options.client ?? _heyApiClient).post<RemoveConfigResponse, unknown, ThrowOnError>({
        url: '/config/remove',
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers
        }
    });
};

export const upsertConfig = <ThrowOnError extends boolean = false>(options: Options<UpsertConfigData, ThrowOnError>) => {
    return (options.client ?? _heyApiClient).post<UpsertConfigResponse, unknown, ThrowOnError>({
        url: '/config/upsert',
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers
        }
    });
};