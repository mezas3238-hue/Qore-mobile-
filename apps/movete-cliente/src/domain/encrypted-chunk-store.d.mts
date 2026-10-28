export type EncryptedStorage={
 getItem:(key:string)=>Promise<string|null>;
 setItem:(key:string,value:string)=>Promise<void>;
 removeItem:(key:string)=>Promise<void>;
};
export declare function createEncryptedChunkStore(options:{
 get:(key:string)=>Promise<string|null>;
 put:(key:string,value:string)=>Promise<unknown>;
 del:(key:string)=>Promise<unknown>;
 randomUUID:()=>string;
 prefix:string;
}):EncryptedStorage;
