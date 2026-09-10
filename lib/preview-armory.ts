import {catalog,cosmeticSlot} from './catalog.ts';

/** Device-local demo inventory. Existing gun finishes remain freely selectable. */
export class PreviewArmory {
  knives=new Set<string>();
  finish='plasma-flow';
  knife='';
  get spent(){return catalog.filter(item=>this.knives.has(item.sku)).reduce((sum,item)=>sum+item.price,0);}
  get inventory(){return catalog.filter(item=>cosmeticSlot(item)==='finish'||this.knives.has(item.sku)).map(item=>({sku:item.sku,equipped:Number(item.sku===this.finish||item.sku===this.knife)}));}
  buy(sku:string,balance:number){
    const item=catalog.find(item=>item.sku===sku);
    if(!item)throw new Error('Unknown cosmetic.');
    if(cosmeticSlot(item)==='finish'||this.knives.has(sku))return 0;
    if(balance<item.price)throw new Error('Add enough demo credits in your wallet first.');
    this.knives.add(sku);return item.price;
  }
  equip(sku:string,slot?:unknown){
    const item=catalog.find(item=>item.sku===sku);
    if(sku&&!item)throw new Error('Unknown cosmetic.');
    if((item?cosmeticSlot(item):slot)==='knife'){
      if(sku&&!this.knives.has(sku))throw new Error('Buy this knife in the shop first.');
      this.knife=sku;
    }else this.finish=sku;
  }
  serialize(){return JSON.stringify({knives:[...this.knives],finish:this.finish,knife:this.knife});}
  restore(raw:string){
    try{
      const saved=JSON.parse(raw);
      this.knives=new Set(catalog.filter(item=>cosmeticSlot(item)==='knife'&&Array.isArray(saved.knives)&&saved.knives.includes(item.sku)).map(item=>item.sku));
      this.finish=catalog.some(item=>item.sku===saved.finish&&cosmeticSlot(item)==='finish')?saved.finish:'';
      this.knife=this.knives.has(saved.knife)?saved.knife:'';
    }catch{/* Keep defaults if a saved preview is unreadable. */}
  }
}
