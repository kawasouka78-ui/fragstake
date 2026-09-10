export const catalog=[
 {sku:'karambit-obsidian',name:'Obsidian Karambit',kind:'Knife model',price:4999,color:'#667481',model:'karambit',description:'A curved talon blade, sculpted black grip and open finger ring. Same melee damage and reach.'},
 {sku:'plasma-flow',name:'Plasma Flow',kind:'Animated finish',price:3499,color:'#986bff',effect:'plasma',description:'Violet and cyan ribbons flow across a black receiver.'},
 {sku:'circuit-breaker',name:'Circuit Breaker',kind:'Animated finish',price:2999,color:'#5ce6c0',effect:'circuit',description:'Electric green traces light up with a travelling scan.'},
 {sku:'molten-core',name:'Molten Core',kind:'Animated finish',price:3999,color:'#ff8348',effect:'molten',description:'Glowing lava cracks drift beneath dark cooled metal.'},
 {sku:'inferno',name:'Inferno',kind:'Weapon wrap',price:1499,color:'#ff783e',description:'Burnt orange panels with charcoal detailing.'},
 {sku:'glacier',name:'Glacier',kind:'Weapon wrap',price:1299,color:'#68d6f0',description:'Cold blue steel for a clean loadout.'},
 {sku:'violet',name:'Violet Protocol',kind:'Weapon wrap',price:1799,color:'#b298ff',description:'Deep violet with bright precision accents.'},
 {sku:'woodland',name:'Woodland',kind:'Weapon wrap',price:999,color:'#86b58c',description:'Muted green field equipment.'},
 {sku:'gold',name:'Gold Standard',kind:'Weapon wrap',price:2499,color:'#e8bf67',description:'Brushed gold. The same weapon statistics.'},
 {sku:'arctic',name:'Arctic',kind:'Weapon wrap',price:1199,color:'#dce7e9',description:'Pale ceramic finish with dark mechanical parts.'}
] as const;
export type Cosmetic=(typeof catalog)[number];
export const cosmeticSlot=(item:Cosmetic|undefined)=>item&&'model' in item?'knife':'finish';
export function equippedCosmetics(inventory:readonly {sku:string;equipped:number}[]){
 const items=catalog.filter(item=>inventory.some(row=>row.sku===item.sku&&row.equipped));
 return {skin:cosmeticFinish(items.find(item=>cosmeticSlot(item)==='finish')),knifeStyle:items.some(item=>cosmeticSlot(item)==='knife')?'karambit' as const:'standard' as const};
}
export function cosmeticFinish(item:Cosmetic|undefined):string|undefined{return item?('effect' in item?'fx:'+item.effect:item.color):undefined;}
export const arenaRooms=[{id:'rookie',name:'Rookie',rate:1,capacity:20,mapId:'relay'},{id:'bronze',name:'Bronze',rate:2,capacity:20,mapId:'foundry'},{id:'silver',name:'Silver',rate:5,capacity:20,mapId:'drydock'},{id:'high-roller',name:'High Roller',rate:10,capacity:12,mapId:'foundry'}] as const;
export const rankNames=['Bronze','Silver','Gold','Platinum','Diamond','Master','Elite'];
export function demoRating(wins:number,matches:number){const rating=Math.max(0,1000+wins*25-(matches-wins)*15);return {rating,rank:rankNames[Math.min(6,Math.floor(Math.max(0,rating-900)/200))]};}
