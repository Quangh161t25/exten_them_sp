const fs = require('fs');
let code = fs.readFileSync('content.js', 'utf8');
const regex = /if \(!parentName\) \{\s*const hEl = parentCard\.querySelector\('\.discount-view-item-header \.ellipsis-content\.single, \.item-header \.ellipsis-content'\);\s*if \(hEl\) parentName = \(hEl\.innerText \|\| ""\)\.replace\(\/\\s\+\/g,' '\)\.trim\(\);\s*\}/;

const newStr = `if (!parentName) {
            const titleCandidates = Array.from(parentCard.querySelectorAll('.discount-view-item-header .ellipsis-content.single, .discount-edit-item-header .ellipsis-content.single, .item-header .ellipsis-content, .ellipsis-content.single'));
            for (const hEl of titleCandidates) {
              if (!hEl.closest('.discount-view-item-model-component, .discount-edit-item-model-component, .discount-item-model-component')) {
                const text = (hEl.getAttribute('title') || hEl.innerText || "").replace(/\\s+/g, ' ').trim();
                if (text && text.toLowerCase() !== "sản phẩm" && text.toLowerCase() !== "product" && text !== varName) {
                  parentName = text;
                  break;
                }
              }
            }
          }`;

if (regex.test(code)) {
    fs.writeFileSync('content.js', code.replace(regex, newStr), 'utf8');
    console.log('Patched');
} else {
    console.log('Not found');
}
