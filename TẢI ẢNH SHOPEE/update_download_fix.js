const fs = require('fs');

let code = fs.readFileSync('d:/tải xuống 2/TẢI ẢNH SHOPEE/assets/index.69efe69f.js', 'utf8');

function extractFunc(name) {
    const s = code.indexOf(name);
    if (s === -1) return null;
    let braces = 0;
    let started = false;
    let e = -1;
    for (let i = s; i < code.length; i++) {
        if (code[i] === '{') {
            braces++;
            started = true;
        }
        if (code[i] === '}') {
            braces--;
            if (started && braces === 0) {
                e = i + 1;
                break;
            }
        }
    }
    return code.substring(s, e);
}

const singleFunc = extractFunc('async downloadImage(');
const allFunc = extractFunc('async downloadAllImages(');
const zipFunc = extractFunc('async downloadImagesZip(');

const newSingleFunc = `async downloadImage(e,o,r){if(!(this.planStore.pro||(X(V,K),parseInt(localStorage.getItem(V)||"0",10)<O)))return void this.goToVip();function getDStr(){const d=new Date();const pad=n=>n.toString().padStart(2,'0');return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes());}let prefix=e==="main"?"c":(e==="desc"||e==="description"?"m":(e==="variant"||e==="variants"?"v":"img"));let idx=(typeof o==='number')?(o+1):(parseInt(o)+1||1);let fn=prefix+getDStr()+"_"+idx+".jpg";await async function(n,s){try{let g=await(await fetch(s)).blob();g.type==="image/webp"&&(g=await W(g));const p=document.createElement("a");p.href=URL.createObjectURL(g);p.download=n;document.body.appendChild(p);p.click();setTimeout(()=>{URL.revokeObjectURL(p.href);document.body.removeChild(p);},1000);}catch(a){console.error("download error:",a);}}(fn,r),!this.planStore.pro&&Number.isFinite(O)&&(function(){X(V,K);const n=parseInt(localStorage.getItem(V)||"0",10);localStorage.setItem(V,(n+1).toString());}(),this.updateRemainingDownloads());}`;

const newAllFunc = `async downloadAllImages(){if(!this.requireProFeature())return;this.allImagesProgress=0;try{const variants=this.productData.categoryImages;const main=this.productData.mainImages;const desc=this.productData.descriptionImages;let total=(variants?variants.length:0)+(main?main.length:0)+(desc?desc.length:0);if(total===0)return;let downloaded=0;const updateP=()=>{this.allImagesProgress=(downloaded/total)*100;if(this.allImagesProgress>=100)setTimeout(()=>this.allImagesProgress=-1,1000);};function getDStr(){const d=new Date();const pad=n=>n.toString().padStart(2,'0');return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes());}const dStr=getDStr();let list=[];if(main)for(let i=0;i<main.length;i++)list.push({url:main[i],prefix:"c",idx:i+1});if(variants)for(let i=0;i<variants.length;i++)list.push({url:(typeof variants[i]==="object"?variants[i].image:variants[i]),prefix:"v",idx:i+1});if(desc)for(let i=0;i<desc.length;i++)list.push({url:desc[i],prefix:"m",idx:i+1});for(let item of list){try{let res=await fetch(item.url);let blob=await res.blob();if(blob.type==="image/webp")blob=await W(blob);const fn=item.prefix+dStr+"_"+item.idx+".jpg";const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);document.body.removeChild(a);},1000);}catch(err){console.error(err);}downloaded++;updateP();await new Promise(res=>setTimeout(res,200));}}catch(e){console.error("Error downloading:",e);this.allImagesProgress=-1;}}`;

const newZipFunc = `async downloadImagesZip(e,o,r){if(!this.requireProFeature())return;this.imageProgresses[r]=0;try{let total=e?e.length:0;if(total===0)return;let downloaded=0;const updateP=()=>{this.imageProgresses[r]=(downloaded/total)*100;if(this.imageProgresses[r]>=100)setTimeout(()=>this.imageProgresses[r]=-1,1000);};function getDStr(){const d=new Date();const pad=n=>n.toString().padStart(2,'0');return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes());}const dStr=getDStr();let prefix=o==="main"?"c":(o==="desc"||o==="description"?"m":(o==="variant"||o==="variants"?"v":"img"));for(let i=0;i<total;i++){let url=e[i];if((o==="variant"||o==="variants")&&typeof e[i]==="object"&&e[i].image)url=e[i].image;try{let res=await fetch(url);let blob=await res.blob();if(blob.type==="image/webp")blob=await W(blob);const fn=prefix+dStr+"_"+(i+1)+".jpg";const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);document.body.removeChild(a);},1000);}catch(err){console.error(err);}downloaded++;updateP();await new Promise(res=>setTimeout(res,200));}}catch(err){console.error("Error:",err);this.imageProgresses[r]=-1;}}`;

if (singleFunc && allFunc && zipFunc) {
    code = code.replace(singleFunc, newSingleFunc);
    code = code.replace(allFunc, newAllFunc);
    code = code.replace(zipFunc, newZipFunc);
    fs.writeFileSync('d:/tải xuống 2/TẢI ẢNH SHOPEE/assets/index.69efe69f.js', code);
    console.log('Successfully updated assets/index.69efe69f.js with requested naming convention!');
} else {
    console.error('Failed to extract one or more functions:', { single: !!singleFunc, all: !!allFunc, zip: !!zipFunc });
}
