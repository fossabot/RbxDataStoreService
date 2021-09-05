// NOTICE Tag internal members as @internal or pull them out.

import { DataStore } from '../DataStore';
import { Globals } from '../../Util/Globals';
import { OrderedDataStore } from '../OrderedDataStore';
import { DataStoreOptions } from '../DataStoreOptions';
import {
	DYNAMIC_FASTFLAGVARIABLE,
	FASTLOG,
	FLog,
	DFFlag,
	LOGGROUP,
	FASTLOGS,
	DFInt,
	DYNAMIC_FASTINT,
} from '../../Tools/FastLogTool';
import { DataStore2 } from '../DataStore2';
import { LuaWebService } from '../LuaWebService';
import { DataStoreListingPages as DataStoreListingPages } from '../DataStoreListingPages';
import { ApiDataStoresUrlConstruction } from '../../Constructors/ApiDataStoresUrlConstruction';
import { InputHelper } from '../../Helpers/InputHelper';

LOGGROUP('DataStore');
DYNAMIC_FASTFLAGVARIABLE('GetGlobalDataStorePcallFix', false);
DYNAMIC_FASTFLAGVARIABLE('DataStoreLostDataFixEnable', false);
DYNAMIC_FASTFLAGVARIABLE('DataStoresV2Enabled', false);

DYNAMIC_FASTINT('DataStoreKeyLengthLimit');

/**
 * @internal
 */
export enum RequestType {
	GET_ASYNC = 5,
	UPDATE_ASYNC = 6,
	SET_ASYNC = 7,
	INCREMENT_ASYNC = 8,
	GET_SORTED_ASYNC_PAGE = 9,
}

type DataStores = Map<string, DataStore>;

export abstract class DataStoreService {
	/**
	 * @internal
	 */
	private static readonly dataStores: DataStores = new Map<string, DataStore>();
	/**
	 * @internal
	 */
	private static readonly orderedDataStores: DataStores = new Map<string, DataStore>();

	/**
	 * @internal
	 */
	public static async checkStudioApiAccess(errorFunction: (e: string) => void) {
		let lws: LuaWebService;
		if ((lws = new LuaWebService()))
			if (!(await lws.IsApiAccessEnabled())) {
				if (errorFunction)
					errorFunction(
						'Cannot write to DataStore from studio if API access is not enabled. Enable it by going to the Game Settings page.',
					);
				return false;
			}
		return true;
	}

	/**
	 * @internal
	 */
	private static useNewApi(options: DataStoreOptions) {
		if (DFFlag('DataStoresV2Enabled')) {
			if (options instanceof DataStoreOptions) {
				const eF = options.GetExperimentalFeatures();
				const it = eF.get('v2');

				if (it && typeof it === 'boolean')
					if (it === true) {
						return true;
					}
				throw new ReferenceError(`Options instance of type ${options.constructor.name} did not request v2 API`);
			}
		} else {
			if (options !== undefined && options !== null)
				throw TypeError('Options instance not of type DataStoreOptions');
		}

		return false;
	}

	/**
	 * @internal
	 */
	private static getDataStoreInternal(
		name: string,
		scope: string,
		legacy: boolean,
		ordered: boolean,
		useNewApi: boolean,
		allScopes: boolean,
	): DataStore | OrderedDataStore {
		if (Globals.PlaceID < 1) {
			if (DFFlag('GetGlobalDataStorePcallFix')) {
				throw new Error('Place has to be opened with Edit button to access DataStores');
			}
			console.error('Place has to be opened with Edit button to access DataStores');
			return process.exit(1);
		}
		if (legacy) {
			if (!this.legacyDataStore) {
				FASTLOG(FLog['DataStore'], '[FLog::DataStore] Creating legacy data store');
				this.legacyDataStore = new DataStore(name, scope, true, allScopes);
			}
			return this.legacyDataStore;
		} else if (ordered) {
			const key = `${name}-${scope}`;
			const it = this.orderedDataStores.has(key);
			if (it === false) {
				FASTLOGS(FLog['DataStore'], '[FLog::DataStore] Creating data store, name: %s', name);
				const ds = new OrderedDataStore(name, scope);
				this.orderedDataStores[key] = ds;
				return ds;
			}
			return this.orderedDataStores[key];
		} else {
			const key = `${name}-${scope}`;
			const it = this.dataStores.has(key);
			if (it === false) {
				FASTLOGS(FLog['DataStore'], '[FLog::DataStore] Creating data store, name: %s', name);
				let ds: DataStore;
				if (!useNewApi) {
					ds = new DataStore(name, scope, false, allScopes);
				} else {
					ds = new DataStore2(name, scope, false, allScopes);
				}
				this.dataStores[key] = ds;
				return ds;
			}
			return this.dataStores[key];
		}
	}

	// private static msReadSuccessAverageRequestTime: UnsignedIntegerCountAverage;
	// private static msErrorAverageRequestTime: UnsignedIntegerCountAverage;
	// private static msWriteAverageRequestTime: UnsignedIntegerCountAverage;
	// private static msUpdateAverageRequestTime: UnsignedIntegerCountAverage;
	// private static msBatchAverageRequestTime: UnsignedIntegerCountAverage;
	// private static readSuccessCachedCount: number;

	/**
	 * @internal
	 */
	private static legacyDataStore: DataStore;

	// private static dataStoreJob: DataStoreJob;

	/**
	 * This function returns the default {@link https://developer.roblox.com/en-us/api-reference/class/GlobalDataStore|GlobalDataStore}.
	 * If you want to access a specific **named** data store instead,
	 * you should use the {@link https://developer.roblox.com/en-us/api-reference/function/DataStoreService/GetDataStore|GetDataStore()} function.
	 * @returns {DataStore} Default {@link https://developer.roblox.com/en-us/api-reference/class/GlobalDataStore|GlobalDataStore} instance
	 * @unsafe For thread safety, this property is not safe to read in an unsynchronized thread.
	 */
	public static GetGlobalDataStore(): DataStore {
		return this.getDataStoreInternal('', 'u', true, false, false, false);
	}

	/**
	 * This function creates a {@link https://developer.roblox.com/en-us/api-reference/class/GlobalDataStore|GlobalDataStore} instance with the provided name and scope.
	 * Subsequent calls to this method with the same name/scope will return the same object.
	 *
	 * ---
	 * NOTICE
	 * --------
	 * If v2.0 experimental features are enabled, this function creates and returns a {@link https://developer.roblox.com/en-us/api-reference/class/DataStore|DataStore} instance instead of a {@link https://developer.roblox.com/en-us/api-reference/class/GlobalDataStore|GlobalDataStore} instance.
	 *
	 * ---
	 *
	 * Using the `scope` parameter will restrict operations to that scope by automatically prepending the scope to keys in all operations done on the data store. This function also accepts an optional {@link https://developer.roblox.com/en-us/api-reference/class/DataStoreOptions|DataStoreOptions} instance which includes options for enabling {@link https://developer.roblox.com/en-us/api-reference/property/DataStoreOptions/AllScopes|AllScopes}. See {@link https://developer.roblox.com/en-us/articles/Data-store#scope|here} for details on scope.
	 * @param {string} name Name of the data store.
	 * @param {string=} scope (Optional) A string specifying the scope.
	 * @param {DataStoreOptions} (Optional) A {@link https://developer.roblox.com/en-us/api-reference/class/DataStoreOptions|DataStoreOptions} instance to enable experimental features and v2 API features.
	 * @returns {DataStore} {@link https://developer.roblox.com/en-us/api-reference/class/GlobalDataStore|GlobalDataStore}
	 * @unsafe For thread safety, this property is not safe to read in an unsynchronized thread.
	 */
	public static GetDataStore(
		name: string,
		scope: string = 'global',
		options: DataStoreOptions = undefined,
	): DataStore {
		InputHelper.CheckNameAndScope(name, scope);
		return this.getDataStoreInternal(
			name,
			scope,
			false,
			false,
			DataStoreService.useNewApi(options),
			options ? options.AllScopes : false,
		);
	}

	/**
	 * This method returns an {@link https://developer.roblox.com/en-us/api-reference/class/OrderedDataStore|OrderedDataStore},
	 * similar to the way {@link https://developer.roblox.com/en-us/api-reference/function/DataStoreService/GetDataStore|GetDataStore()} does with {@link https://developer.roblox.com/en-us/api-reference/class/GlobalDataStore|GlobalDataStores}.
	 * Subsequent calls to this method with the same name/scope will return the same object.
	 *
	 * @param {string} name The name of the {@link https://developer.roblox.com/en-us/api-reference/class/OrderedDataStore|OrderedDataStore} you wish to get.
	 * @param {string="global"} scope The scope of the {@link https://developer.roblox.com/en-us/api-reference/class/OrderedDataStore|OrderedDataStore} you wish to get, global by default
	 * @returns {OrderedDataStore} {@link https://developer.roblox.com/en-us/api-reference/class/OrderedDataStore|OrderedDataStore}
	 * @unsafe For thread safety, this property is not safe to read in an unsynchronized thread.
	 */
	public static GetOrderedDataStore(name: string, scope: string = 'global'): OrderedDataStore {
		InputHelper.CheckNameAndScope(name, scope);
		return this.getDataStoreInternal(name, scope, false, true, false, false) as OrderedDataStore;
	}

	/**
	 * This is a funny method that existed for a while and then was purged. Don't use it, all it does is allow you to fetch a key from an empty scope.
	 * @param {string} name The name of the {@link https://developer.roblox.com/en-us/api-reference/class/GlobalDataStore|GlobalDataStore} you wish to get.
	 * @param {string} key The key identifying the entry being retrieved from the data store.
	 * @returns {Variant} {@link https://developer.roblox.com/en-us/api-reference/data-types|Variant}
	 * @yields This is a yielding function. When called, it will pause the JavaScript thread that called the function until a result is ready to be returned, without interrupting other scripts.
	 * @deprecated This function has been deprecated and should not be used in new work.
	 */
	public static async GetDataFromEmptyScopeDataStoreAsyncTemporary<Variant extends any>(
		name: string,
		key: string,
	): Promise<Variant> {
		return new Promise<Variant>(async (resumeFunction, errorFunction) => {
			if (!DFFlag['DataStoreLostDataFixEnable']) {
				errorFunction('GetDataFromEmptyScopeDataStoreAsyncTemporary is not enabled');
				return;
			}
			if (name.length == 0) {
				errorFunction("DataStore name can't be empty string");
				return;
			}

			if (name.length > DFInt('DataStoreKeyLengthLimit')) {
				errorFunction('DataStore name is too long');
				return;
			}
			const ds = this.getDataStoreInternal(name, '', false, false, false, false);
			const value = await ds.GetAsync(key);
			resumeFunction(<Variant>value);
		});
	}

	/**
	 * Returns a {@link https://developer.roblox.com/en-us/api-reference/class/DataStoreListingPages|DataStoreListingPages} object for enumerating through all of the experience’s data stores.
	 * It accepts an optional `prefix` parameter to only locate data stores whose names start with the provided prefix.
	 *
	 * ---
	 * NOTICE
	 * ------
	 * Only data stores containing at least one object will be listed via this function.
	 *
	 * ---
	 *
	 * SEE ALSO
	 * --------
	 * - {@link https://developer.roblox.com/en-us/articles/Data-store|Data Stores}, an in-depth guide on data structure, management, error handling, etc.
	 * ---
	 *
	 * @param {string} prefix (Optional) Prefix to enumerate data stores that start with the given prefix.
	 * @param {number} pageSize (Optional) Number of items to be returned in each page.
	 * @returns {DataStoreListingPages} {@link https://developer.roblox.com/en-us/api-reference/class/DataStoreListingPages|DataStoreListingPages} instance containing {@link https://developer.roblox.com/en-us/api-reference/class/DataStoreInfo|DataStoreInfo} instances that provide details such as name, creation time, and time last updated.
	 * @yields This is a yielding function. When called, it will pause the Javascript thread that called the function until a result is ready to be returned, without interrupting other scripts.
	 * @unsafe For thread safety, this property is not safe to read in an unsynchronized thread.
	 */
	public static async ListDataStoresAsync(prefix: string = '', pageSize: number = 0): Promise<DataStoreListingPages> {
		return new Promise(async (resumeFunction, errorFunction) => {
			if (!DFFlag('DataStoresV2Enabled')) {
				errorFunction('400: API not supported');
				return;
			}

			if (!(await DataStoreService.checkStudioApiAccess(errorFunction))) return;

			const url = ApiDataStoresUrlConstruction.constructListKeysUrl(
				undefined,
				Globals.UniverseID,
				prefix,
				pageSize,
			);

			const page = new DataStoreListingPages(this, url);
			await page.AdvanceToNextPageAsync();
			return resumeFunction(page);
		});
	}
}
