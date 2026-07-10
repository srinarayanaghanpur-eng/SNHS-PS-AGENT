import{findLayer}from'./layerLookup';export function setVisibility(document:any,ids:number[],visible:boolean){for(const id of ids){const l=findLayer(document,id);if(l)l.visible=visible}}
