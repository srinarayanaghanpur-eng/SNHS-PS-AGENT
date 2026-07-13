export interface Score {score:number;reasons:string[]}
export function addScore(target:Score,points:number,reason:string){target.score+=points;target.reasons.push(reason)}
export function confidence(score:number){return Math.max(0,Math.min(100,Math.round(score)))}
