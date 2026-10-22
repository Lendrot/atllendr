export type AtlasPresentationRow={id:string;buyerId:string;targetId:string;area:string;originalFlowId?:string;dealValueView?:boolean;[key:string]:unknown};
export type AtlasPresentationEntity={lat?:number;lon?:number;schematic?:boolean;countryCode?:string;[key:string]:unknown};
export function mapRows<T extends AtlasPresentationRow>(rows:T[],entities:Record<string,AtlasPresentationEntity>,view?:string|{distance:number;center:{lat:number;lon:number}},selectedId?:string|null):T[];
export function precisionLabel(entity:AtlasPresentationEntity):string;
export function counts(layer:{entities:Record<string,AtlasPresentationEntity>;deals:AtlasPresentationRow[]}):{entities:number;countries:number;verified:number;historical:number;physical:number;economic:number;gaps:number};
export function neighbors<T extends AtlasPresentationRow>(layer:{deals:T[]},entityId:string):T[];
export function qualityLabel(row:AtlasPresentationRow):string;
export function auditLabel(row:AtlasPresentationRow):string;
