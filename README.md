# Bruce Cell — gestão da loja

Interface para ordens de serviço, clientes, ponto de venda, estoque, caixa e WhatsApp.

## Executar

Na pasta `whatsapp-api`, no primeiro acesso, execute:

```powershell
npm run setup
npm start
```

O comando `setup` pergunta o nome da loja, seu e-mail e uma senha de pelo menos 12 caracteres. A senha não é exibida nem gravada em texto simples. Depois abra `http://localhost:3000` e entre com os dados escolhidos. Nas próximas vezes, use apenas `npm start`.
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

## Lojas, usuários e WhatsApp

- O administrador inicial encontra o botão **Lojas** no topo. Cadastre nome, e-mail e senha inicial para cada comprador.
- Cada loja tem um responsável (`owner`). Ele acessa apenas o banco, caixa, ordens, produtos e WhatsApp de sua própria loja; não pode cadastrar ou administrar outras lojas.
- **Minha conta** permite alterar a senha. A troca invalida todas as sessões da conta.
- **Desativar** uma loja invalida suas sessões e encerra seu cliente de WhatsApp. Os dados ficam preservados e o acesso pode ser reativado.
- Em **Conectar WhatsApp**, o responsável escaneia o QR exclusivo da loja usando o próprio telefone. A sessão só é iniciada quando esse botão é usado; não são lançados navegadores para todas as lojas na inicialização do servidor.
- **Desconectar** remove o vínculo do WhatsApp daquela loja. Não interfere nas outras lojas.
- Reiniciar o servidor mantém os dados de autenticação em disco. Cada loja precisa clicar em Conectar WhatsApp para restaurar sua conexão; um novo QR só é necessário se a sessão não estiver mais válida.

Não há cadastro público. O administrador cria os acessos depois da venda. O pagamento e a emissão automática de licenças ainda não estão integrados.

### Preservação dos registros existentes

O primeiro administrador recebe a loja interna `legacy`, vinculada ao `brucecell.db` já existente e ao diretório `.wwebjs_auth` original. Os registros e a sessão não são copiados para outras lojas. Novas lojas usam arquivos SQLite separados em `data/stores/<id>/store.sqlite` e autenticação de WhatsApp identificada por `store-<id>`. A identidade, as senhas com scrypt e as sessões do sistema ficam em `data/accounts.sqlite`. O ID da loja é obtido pelo servidor a partir da sessão autenticada, nunca de um parâmetro enviado pelo navegador.

O botão Sair encerra o acesso ao sistema; mantém o WhatsApp da loja funcionando para notificações. Para remover o vínculo, use Desconectar.

## Hospedagem

Esta implementação usa **um processo Node.js**, SQLite e um Chromium por WhatsApp conectado. Hospede o backend em um servidor que permita processos persistentes, Chromium e disco persistente. Hospedagem apenas de arquivos estáticos não executa a API. Não execute várias réplicas contra os mesmos arquivos de sessão; a distribuição entre workers exige outra arquitetura.

Configuração de produção, antes de executar `npm start`:

```powershell
$env:NODE_ENV = "production"
$env:PORT = "3000"
$env:ALLOWED_ORIGINS = "https://seu-dominio.com.br"
# Apenas quando houver um proxy reverso confiável imediatamente à frente:
$env:TRUST_PROXY = "1"
```

Use HTTPS por proxy reverso e entregue interface e API pelo mesmo domínio. Em produção o cookie é HttpOnly, Secure e SameSite=Lax; ele não funciona por HTTP. As mutações exigem o token CSRF da sessão e as origens não autorizadas são recusadas. O suporte ao Go Live é de desenvolvimento; frontend em outro domínio exige revisar cookies, origens e implantação.

`DATA_DIR` pode apontar para um volume persistente para os arquivos novos. O banco e a sessão legados continuam na pasta original do projeto. Preserve ambos no volume da implantação. Faça backup consistente dos bancos e diretórios de autenticação, restrinja o acesso a esses arquivos e verifique restauração antes de receber clientes reais. Os arquivos não são disponibilizados pelas rotas públicas.

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

`npm run test:tenant` verifica autenticação, CSRF, CORS, isolamento dos bancos, preservação de dados legados, suspensão de acessos, troca de senha e sessões de WhatsApp separadas. `npm run test:auth` verifica o fluxo real de login no navegador, cadastro de loja, registros separados, escape de HTML, QR e logout. Usam bancos temporários e clientes de WhatsApp simulados, sem mensagens reais.

## Antes da comercialização

Autenticação, permissões de administrador/responsável e isolamento entre lojas estão implementados e testados. A integração atual continua baseada em `whatsapp-web.js`, não na API oficial da Meta. Os testes de conexão usam um cliente simulado; cada cliente real precisa conectar seu telefone após a implantação.

Ainda é necessário tornar a venda e a baixa de estoque uma transação única no servidor (o PDV legado faz requisições separadas), estruturar recuperação de senha e backups/restauração, avaliar a API oficial do WhatsApp e definir os termos/licenciamento comercial. Ainda não foi feita implantação pública ou um teste de capacidade com várias conexões reais de WhatsApp.
