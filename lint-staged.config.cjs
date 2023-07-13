module.exports = {
  "*.ts": [() => "tsc -p tsconfig.json --noEmit", "rome check --apply"],
};
