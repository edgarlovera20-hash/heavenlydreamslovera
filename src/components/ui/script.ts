import fs from 'fs';
const targetFile = 'src/components/views/NewSaleForm.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

// Insert import if absent
if (!content.includes("import { MatrixInput }")) {
  content = content.replace("import { AnimatedCheckbox } from '../ui/AnimatedCheckbox';", "import { AnimatedCheckbox } from '../ui/AnimatedCheckbox';\nimport { MatrixInput } from '../ui/MatrixInput';");
}

content = content.replace(/<input type="text"/g, '<MatrixInput type="text"');
content = content.replace(/<input type="tel"/g, '<MatrixInput type="tel"');
content = content.replace(/<input type="email"/g, '<MatrixInput type="email"');
// we dont have </input> as input is self closing usually in JSX. But if there is </input>, replace it.
content = content.replace(/<\/input>/g, '<\/MatrixInput>');

fs.writeFileSync(targetFile, content);
console.log("Replaced successfully");
