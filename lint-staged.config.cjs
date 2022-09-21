module.exports = {
  "*.ts": [() => "yarn check -p tsconfig.json --noEmit", "yarn lint --fix"],
};
