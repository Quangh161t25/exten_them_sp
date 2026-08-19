const fs = require('fs');
let code = fs.readFileSync('d:/tải xuống 2/TẢI ẢNH SHOPEE/assets/index.69efe69f.js', 'utf8');

const s = code.indexOf('async downloadAllImages(){');
if (s !== -1) {
    // We will replace the filename string constructions
    // Old: prefix + dStr + (i+1) + ".jpeg"
    // New: prefix + dStr + "_" + (i+1) + ".jpg"
    // And getD() function to YYYYMMDD_HHmm
    
    // First, fix getD()
    const oldGetD = "return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'_'+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());";
    const newGetD = "return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'_'+p(d.getHours())+p(d.getMinutes());";
    code = code.replace(oldGetD, newGetD);
    code = code.replace(oldGetD, newGetD); // replace twice for both functions if they didn't merge
    
    // Now fix filename extension and format
    // search for prefix + dStr + (i+1) + ".jpeg"
    // because dStr is variable, let's just replace `.jpeg` to `.jpg` and add `+"_"` 
    // wait, it's safer to use regex
    code = code.replace(/prefix \+ dStr \+ \(i\+1\) \+ "\.jpeg"/g, 'prefix + dStr + "_" + (i+1) + ".jpg"');
    
    fs.writeFileSync('d:/tải xuống 2/TẢI ẢNH SHOPEE/assets/index.69efe69f.js', code);
    console.log("Updated filename format");
} else {
    console.log("Could not find downloadAllImages");
}
