# Bruce Cell — gestão da loja

Interface para ordens de serviço, clientes, ponto de venda, estoque, caixa e WhatsApp.

## Executar

Requer Node.js 22 ou superior. Depois de clonar este repositório, na pasta que contém `package.json`, execute:

```powershell
npm ci
npm run install:browser
npm run setup
npm start
```

O comando `setup` pergunta o nome da loja, seu e-mail e uma senha de pelo menos 12 caracteres. A senha não é exibida nem gravada em texto simples. Depois abra `http://localhost:3000` e entre com os dados escolhidos. Nas próximas vezes, use apenas `npm start`.
Em outro dispositivo na mesma rede, use o IP do computador seguido de `:3000`.
O serviço entrega apenas os arquivos públicos listados explicitamente; o banco e as sessões não são arquivos públicos.

Também é possível abrir `index.html` com o Go Live do VS Code. Nas portas 5500–5599, `api-config.js` direciona as chamadas de dados/WhatsApp para a porta 3000 do mesmo computador. O `npm start` precisa continuar rodando. Ao alterar as rotas do servidor, reinicie com Ctrl+C e `npm start`. As folhas de estilo usam versão na URL e o Express serve os arquivos públicos sem cache para evitar versões antigas.

## Interface

### Levar para outro computador

Pare o servidor antes de copiar os arquivos. Para manter os acessos e registros, inclua `data/` (ou o diretório configurado em `DATA_DIR`) e `brucecell.db` no seu arquivo privado de transferência. Inclua também a pasta `.agents/` que fica no diretório pai de `whatsapp-api` para levar as skills.

Não precisa levar `node_modules`, `.npm-cache`, `.git`, `.taste-skill`, `.wwebjs_cache` nem os perfis de navegador `.wwebjs_auth` e `data/whatsapp`. Copie os bancos e arquivos da aplicação; no computador doméstico, execute na pasta `whatsapp-api`:

```powershell
npm ci
npm run install:browser
npm start
```

Se copiou `data/accounts.sqlite`, use o mesmo login; não precisa cadastrar o administrador de novo. Se estiver começando sem esse banco, execute `npm run setup` antes de iniciar. Conecte novamente cada telefone pelo QR no novo PC. Os perfis do navegador podem depender do usuário e da máquina originais; os bancos da aplicação preservam seus dados independentemente disso. Não execute as duas cópias como se fossem o mesmo servidor: elas não sincronizam os registros.

### Falha ao iniciar o QR Code

O carregamento agora usa `webVersionCache: none`, sem reutilizar os arquivos HTML antigos do WhatsApp Web. A autenticação de cada empresa permanece em seu perfil separado. O painel mostra orientações específicas quando faltam navegador, internet ou permissões, quando existe outro processo usando o perfil e quando há tempo esgotado. O terminal mantém o erro técnico para diagnóstico.

Se o perfil salvo não carregar, use **Gerar novo QR** no modal de conexão. A ação pede confirmação, encerra o cliente daquela empresa, renomeia seu perfil como `.backup-<identificador>` e inicia um perfil limpo; não apaga o banco nem os perfis das outras empresas. Será necessário escanear novamente. Backups de autenticação continuam sendo arquivos privados e não devem ser distribuídos. Se houver outra execução usando o mesmo perfil, feche-a primeiro.

`npm run test:whatsapp` verifica os erros e a recuperação com clientes simulados, sem alterar sua sessão real.

- Navegação lateral no desktop e menu recolhido no celular.
- Visão de gestão da loja com faturamento, etapas da oficina, aparelhos prontos e alertas de estoque.
- PDV com busca por nome/código, tipos de acessórios e ajuste de quantidades; catálogo e venda em vistas alternadas no celular e tablet.
- Indicadores de faturamento e filtros por etapa das ordens, derivados da API.
- Tema claro/escuro persistido, links diretos por aba e ações rápidas.
- Modais com foco, Escape e navegação por teclado.
- Avisos de indisponibilidade, atualização manual e respeito à redução de movimento.

`dashboard.css`, `account.css` e `commercial.css` contêm estilos base; `bruce.css` é a camada visual compartilhada por todas as páginas, com jade, navegação verde profunda e fonte Manrope local (licença em `assets/fonts/OFL-Manrope.txt`). `dashboard.js` complementa os fluxos do HTML com navegação e acessibilidade. A visão de gestão abre primeiro; os botões Novo cliente e Nova OS ficam na consulta de ordens. O menu **Minha loja** reúne conta, integrações e acesso à central do proprietário, conforme a função do usuário.

No PC, as ações de cadastro ficam agrupadas no cabeçalho da consulta. Busca e filtro compartilham uma barra, e cada ordem apresenta status e impressão lado a lado. O menu Imprimir oferece bobina e A4 e fecha com Escape ou clique fora. No celular, as ordens são cartões com os comandos visíveis, sem rolagem horizontal da lista.

## Lojas, usuários e WhatsApp

- O administrador inicial encontra o botão **Lojas** no topo. Cadastre nome, e-mail e senha inicial para cada comprador.
- Cada loja tem um responsável (`owner`). Ele acessa apenas o banco, caixa, ordens, produtos e WhatsApp de sua própria loja; não pode cadastrar ou administrar outras lojas.
- **Minha conta** permite alterar a senha. A troca invalida todas as sessões da conta.
- **Desativar** uma loja invalida suas sessões e encerra seu cliente de WhatsApp. Os dados ficam preservados e o acesso pode ser reativado.
- Em **Conectar WhatsApp**, o responsável escaneia o QR exclusivo da loja usando o próprio telefone. A sessão só é iniciada quando esse botão é usado; não são lançados navegadores para todas as lojas na inicialização do servidor.
- **Desconectar** remove o vínculo do WhatsApp daquela loja. Não interfere nas outras lojas.
- Reiniciar o servidor mantém os dados de autenticação em disco. Cada loja precisa clicar em Conectar WhatsApp para restaurar sua conexão; um novo QR só é necessário se a sessão não estiver mais válida.

Não há cadastro público. O administrador cria os acessos depois da venda. O modelo comercial é **mensalidade por empresa**, com liberação manual após a confirmação do pagamento. O painel **Lojas** permite consultar empresas, pesquisar, suspender acessos e editar plano, mensalidade, franquia e vencimento. Não há processamento ou comprovação automática de pagamento.

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

## Mensalidades e API por empresa

Novas empresas começam em avaliação por 30 dias, com 1.000 mensagens por mês. Esses valores são padrões iniciais editáveis, não preços comerciais definidos. Empresas anteriores recebem uma avaliação na primeira migração; o administrador legado permanece sem vencimento. Ajuste os contratos reais antes de liberar compradores.

No painel **Lojas**, use **Editar mensalidade** para definir plano, valor em reais, mensagens por mês, último dia de acesso e situação do contrato. A data escolhida vale até 23h59min59s de São Paulo. Renovar não zera o consumo do mês. O indicador de mensalidades soma os contratos ativos, liberados e fora de avaliação; não representa valores recebidos.

O vencimento bloqueia a API externa, novos envios (inclusive notificações de OS e mensagens pelo painel), novas chaves e novas conexões. O responsável ainda pode entrar no painel, consultar seus registros e revogar chaves. Suspender a empresa bloqueia login e chaves, invalida os cookies existentes e encerra seu cliente de WhatsApp. Reativação exige novo login; as chaves não revogadas voltam a valer se o contrato estiver vigente.

Em **API e plano**, cada responsável acompanha sua conexão, plano e consumo; gera até cinco chaves ativas e pode revogá-las. A chave completa aparece uma única vez; o servidor guarda somente SHA-256 e um prefixo de identificação. Não coloque chaves no frontend, em URLs ou em repositórios. A administração e o banco da loja não são acessíveis por essas chaves.

Endpoints externos com `Authorization: Bearer SUA_CHAVE`:

- `GET /v1/account`: empresa, plano e consumo.
- `GET /v1/whatsapp/status`: conexão, sem QR.
- `GET /v1/messages`: 30 registros recentes, sem destinatário nem texto.
- `POST /v1/messages`: corpo `{"to":"5511999999999","text":"Olá!"}` e cabeçalho obrigatório `Idempotency-Key` (8–128 caracteres).

A especificação [OpenAPI](openapi.json) pode ser importada em ferramentas de integração. O endereço-base é o domínio do backend seguido de `/v1`. A chave determina a empresa; parâmetros enviados pelo integrador não trocam o ambiente. O telefone precisa ser conectado pelo painel usando seu QR exclusivo.

Repetir identificador e conteúdo retorna o envio já confirmado sem enviá-lo de novo. Conteúdo diferente, operação em curso ou sem confirmação resulta em 409. Um erro do provedor resulta em 502 e fica sem confirmação: confira o WhatsApp antes de usar outra identificação. Envios interrompidos pelo reinício do servidor também ficam sem confirmação. `sent` significa que a chamada ao WhatsApp Web concluiu; não confirma entrega ou leitura pelo destinatário.

O limite é de 60 requisições por minuto **por empresa**, compartilhado entre suas chaves. A franquia conta envios novos e tentativas sem confirmação no mês civil em UTC, incluindo mensagens do painel e notificações de OS. Não há filas de reenvio automático, webhooks de recebimento nem conciliação com gateway de pagamento nesta versão. Não use várias réplicas: o controle por minuto é em memória e as sessões dependem de um processo.

## Venda e estoque

O PDV usa `POST /vendas`: o servidor consulta preços, valida o estoque e grava ordem, baixa e movimento de caixa em uma transação SQLite. Uma falha desfaz tudo. A identificação da venda evita duplicar estoque e caixa ao repetir a mesma requisição. Quando o caixa está fechado, a venda é gravada sem movimento de caixa e a interface informa isso.

## Verificação

Execute `npm run test:ui`. O teste usa servidor e dados simulados, sem acessar o banco da loja ou enviar mensagens. Verifica quatro tamanhos de tela, abas, filtros, teclado nos modais, temas e falha de conexão. Produz `preview-desktop.png` e `preview-mobile.png`.

`npm run test:tenant` verifica autenticação, CSRF, CORS, isolamento dos bancos, preservação de dados legados, suspensão de acessos, troca de senha e sessões de WhatsApp separadas. `npm run test:auth` verifica o fluxo real de login no navegador, cadastro de loja, registros separados, escape de HTML, QR e logout. Usam bancos temporários e clientes de WhatsApp simulados, sem mensagens reais.

`npm run test:commercial` verifica isolamento e revogação de chaves, limites concorrentes, idempotência, vencimento, renovação, suspensão, persistência após reinício e venda transacional. `npm run test:commercial-ui` verifica as telas de mensalidades e integração em Chromium com dados temporários; produz capturas em `previews/`. O navegador precisa ter permissão para executar processos e gravar seus perfis temporários.

## Antes da comercialização

Autenticação, permissões de administrador/responsável e isolamento entre lojas estão implementados e testados. A integração atual continua baseada em `whatsapp-web.js`, não na API oficial da Meta. Os testes de conexão usam um cliente simulado; cada cliente real precisa conectar seu telefone após a implantação.

Ainda é necessário estruturar recuperação de senha e backups/restauração, escolher e integrar um gateway se houver cobrança automática, avaliar a API oficial do WhatsApp e definir os termos comerciais. Ainda não foi feita implantação pública ou teste de capacidade com várias conexões reais de WhatsApp. Consulte [a análise técnica](ANALISE.md), incluindo os alertas de dependências que permanecem na integração WhatsApp Web.
