# Bruce Cell — gestão da loja

Interface para ordens de serviço, clientes, ponto de venda, estoque, caixa e WhatsApp.

## Executar

Na pasta `whatsapp-api`, execute `npm start` e abra `http://localhost:3000`.
Em outro dispositivo na mesma rede, use o IP do computador seguido de `:3000`.
O serviço entrega apenas os arquivos públicos listados explicitamente; o banco e as sessões não são arquivos públicos.

Também é possível abrir `index.html` com o Go Live do VS Code. Nas portas 5500–5599, `api-config.js` direciona as chamadas de dados/WhatsApp para a porta 3000 do mesmo computador. O `npm start` precisa continuar rodando. Ao alterar as rotas do servidor, reinicie com Ctrl+C e `npm start`. As folhas de estilo usam versão na URL e o Express serve os arquivos públicos sem cache para evitar versões antigas.

## Interface

- Navegação lateral no desktop e navegação horizontal no celular.
- Indicadores de faturamento e filtros por etapa das ordens, derivados da API.
- Tema claro/escuro persistido, links diretos por aba e ações rápidas.
- Modais com foco, Escape e navegação por teclado.
- Avisos de indisponibilidade, atualização manual e respeito à redução de movimento.

`dashboard.css` contém a base; `oficina.css` define a identidade grafite/cobre, controles e layout operacional. `dashboard.js` complementa os fluxos do HTML com navegação e acessibilidade. A consulta de ordens aparece primeiro; os botões Novo cliente e Nova OS abrem seus respectivos formulários.

No PC, as ações de cadastro ficam agrupadas no cabeçalho da consulta. Busca e filtro compartilham uma barra, e cada ordem apresenta status e impressão lado a lado. O menu Imprimir oferece bobina e A4 e fecha com Escape ou clique fora. No celular, as ordens são cartões com os comandos visíveis, sem rolagem horizontal da lista.

## Publicidade de parceiros

O espaço de publicidade fica após o conteúdo da aba, fora dos formulários e da impressão. Ele começa oculto. Para ativar, edite `publicidade.json` e preencha os dados reais do anunciante:

```json
{
  "enabled": true,
  "sponsor": "Nome do parceiro",
  "title": "Título do anúncio",
  "description": "Texto curto da oferta",
  "url": "https://dominio-do-parceiro.com.br",
  "cta": "Ver oferta"
}
```

Recarregue a página após editar. Use `enabled: false` para retirar o anúncio. Só URLs HTTPS sem credenciais são aceitas; textos são inseridos como texto simples. Os links abrem em outra aba com `sponsored`, `noopener` e `noreferrer`. Não há scripts de terceiros, coleta de dados da loja, rastreamento de impressões/cliques ou integração com uma rede de anúncios nesta implementação. O arquivo é público: não inclua segredos nele.

## Licença de pagamento único

O modelo pretendido é uma licença paga uma vez, com publicidade no produto. A aplicação ainda não implementa emissão, ativação ou validação de licenças. Antes de implementar esse fluxo, é preciso definir se a licença pertence a uma loja, computador ou usuário e quais atualizações/suporte estão incluídos. A identidade visual não representa uma licença já ativada.

## Verificação

Execute `npm run test:ui`. O teste usa servidor e dados simulados, sem acessar o banco da loja ou enviar mensagens. Verifica quatro tamanhos de tela, abas, filtros, teclado nos modais, temas e falha de conexão. Produz `preview-desktop.png` e `preview-mobile.png`.

## Antes da comercialização

A revisão atual melhora a interface; o servidor ainda não implementa autenticação, permissões por usuário ou isolamento entre lojas. Antes de disponibilizar na internet, essas funções precisam ser implementadas e verificadas.

Também é necessário tornar a venda e a baixa de estoque uma transação única no servidor (atualmente são requisições separadas), validar valores e estoque no backend, escapar dados inseridos em tabelas HTML, estruturar backups/restauração e avaliar a integração oficial do WhatsApp. Não considere a mudança visual uma validação dessas áreas.
