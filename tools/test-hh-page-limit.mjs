import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as model from '../extension/hh-api/returns.js';

class Element {
  constructor(){this.children=[];this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.classList={toggle(){}};}
  append(...nodes){this.children.push(...nodes);}
  appendChild(node){this.children.push(node);}
  replaceChildren(...nodes){this.children=nodes;}
  get firstChild(){return this.children[0];}
}
const elements=new Map(),el=key=>{if(!elements.has(key))elements.set(key,new Element());return elements.get(key);};
const pages=[],saved={};let terminalPage=0;
const context={...model,console,Date,Set,Object,Number,String,Promise,
  document:{querySelector:el,querySelectorAll:()=>[],createElement:()=>new Element()},
  setTimeout:fn=>{fn();},
  chrome:{storage:{local:{get:async()=>({}),set:async data=>Object.assign(saved,data)}}},
  getShopInfo:async()=>({shopId:7,name:'Test'}),
  request:async(method,path,{body})=>{
    assert.equal(method,'POST');assert.equal(path,model.LIST_PATH);pages.push(body.page_number);
    const count=terminalPage&&body.page_number===terminalPage?5:40;
    return {total:terminalPage?45:1000,pagination_info:{has_more:body.page_number!==terminalPage},exceptional_case_list:Array.from({length:count},(_,i)=>({entity_id_str:`2-${body.page_number}-${i}`,entity_type:2,order_id:body.page_number*100+i,order_sn:`TEST${body.page_number}-${i}`,product_items:[]}))};
  }
};
vm.createContext(context);
const source=(await fs.readFile(new URL('../extension/hh-api/app.js',import.meta.url),'utf8')).replace(/^(?:import[^\n]*\n)+/,'');
vm.runInContext(source,context);await Promise.resolve();el('#code').value='BCE';
el('#page-limit').value='1';await context.readShopee();assert.deepEqual(pages,[1]);assert.ok(el('#status').textContent.includes('giới hạn 1 trang'));assert.equal(el('#btn-write').disabled,false);assert.equal(saved.hh_api_page_limit,1);
pages.length=0;el('#page-limit').value='3';await context.readShopee();assert.deepEqual(pages,[1,2,3]);assert.ok(el('#status').textContent.includes('giới hạn 3 trang'));
pages.length=0;terminalPage=2;el('#page-limit').value='5';await context.readShopee();assert.deepEqual(pages,[1,2]);assert.ok(el('#status').textContent.includes('cuối danh sách'));
for(const invalid of ['',0,-1,1.5,201]){pages.length=0;el('#page-limit').value=String(invalid);await context.readShopee();assert.equal(pages.length,0);assert.ok(el('#status').textContent.includes('số nguyên'));}
console.log('PASS: giới hạn 1/3 trang đúng số request, hết dữ liệu dừng sớm, giới hạn chủ động không báo lỗi thiếu, giữ tùy chọn và chặn số trang không hợp lệ.');
