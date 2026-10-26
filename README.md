# Dashboard das eleições de 2026

Página estática com o resultado presidencial por unidade da federação.

## Desenvolvimento

Use o Node ARM disponível na máquina:

```sh
PATH=/opt/homebrew/bin:$PATH npm install
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Para conferir o build:

```sh
PATH=/opt/homebrew/bin:$PATH npm run build
PATH=/opt/homebrew/bin:$PATH npm run preview
```

`npm run ingest:tse` atualiza manualmente o snapshot dos resultados. O
navegador não consulta o TSE nem o IBGE.

## Publicação

As rotas `/brasil/1` e `/{uf}/{turno}` são tratadas no cliente. O host
estático deve servir o mesmo `index.html` para caminhos que não correspondam
a um arquivo, mantendo os assets intactos. Sem esse fallback, abrir ou
recarregar um link profundo retorna 404 antes que a aplicação possa ler a
URL.

O servidor de desenvolvimento do Vite e `vite preview` já fazem esse fallback
localmente.
