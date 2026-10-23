# Análise técnica e preparação comercial

Modelo confirmado: mensalidade por empresa. A aplicação agora possui um fluxo comercial local utilizável, com liberação manual. Não foi publicada nem validada com telefones reais nesta alteração.

## O que foi encontrado e tratado

| Ponto | Situação |
| --- | --- |
| Identidade e dados por empresa | Já existiam; preservados e verificados por testes. |
| WhatsApp por empresa | Sessões e QR separados; a API usa sempre a empresa autenticada. |
| Integração externa | Adicionados endpoints `/v1`, Bearer por empresa, geração/revogação e hash das chaves. |
| Mensalidades | Plano, valor, franquia e vencimento editáveis pelo administrador; restrição de API e envios quando vence. |
| Consumo e reenvios | Contagem persistente, reserva serializada da franquia, limite por minuto e identificador por mensagem. |
| Privacidade dos envios | Histórico com ID, data e estado; texto e destinatário não são persistidos nessa tabela. |
| PDV | Venda, estoque e caixa agora usam uma transação; preços vêm do banco, com proteção contra repetição. |
| Interface | Painel de empresas com busca e contrato; portal do contratante com plano, chaves, documentação e histórico; layouts desktop/mobile. |
| Dependências | Aplicadas seis atualizações compatíveis via npm audit fix; o alerta crítico de proxy-addr foi resolvido. |
| Versionamento | O repositório já rastreava dependências, banco, JSONs de dados e sessões do WhatsApp apesar do `.gitignore`. Esses arquivos foram retirados do índice, preservando as cópias no disco. |

## Limites que precisam entrar no planejamento da venda

- **Provedor:** o projeto usa `whatsapp-web.js@1.34.7`, que automatiza WhatsApp Web. Não é a API oficial da Meta. Testes usam clientes simulados; QR, envio real, estabilidade, política de uso e capacidade precisam ser validados antes de receber clientes de produção. Fontes: [Client](https://docs.wwebjs.dev/Client.html), [LocalAuth](https://docs.wwebjs.dev/LocalAuth.html) e [plataforma da Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/overview).
- **Dependências:** após as correções compatíveis, o npm audit ainda aponta nove pacotes com severidade alta na cadeia do Puppeteer, com raízes em `basic-ftp` e `extract-zip`. O npm sugere downgrade de WhatsApp para resolver a cadeia; não foi aplicado por ser uma mudança incompatível. `extract-zip@2.0.1` ainda é a versão publicada mais recente consultada. Não há declaração de que esta árvore esteja livre de vulnerabilidades. Conferir [symlink em extract-zip](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) e [parser FTP](https://github.com/advisories/GHSA-c475-qrg2-pj4r).
- **Pagamento:** não há gateway, emissão de boleto/Pix, assinatura no cartão ou webhook de confirmação. A situação do contrato é lançada manualmente; o valor agregado no painel não é um relatório de recebimentos.
- **Escala:** um processo Node, SQLite em disco persistente e um Chromium por empresa conectada. Não há escalonamento horizontal, failover ou teste de carga com telefones reais. O limite de requisições é por processo.
- **Operação:** configurar HTTPS, origens permitidas e proxy confiável; proteger os arquivos de dados e autenticação. Criar e testar backup/restauração e recuperação administrativa de senha. Os dados legados permanecem no banco e diretório originais.
- **Histórico Git:** retirar arquivos do índice impede novos commits, mas não apaga versões anteriores. Se o repositório foi compartilhado, tratar a exposição das sessões e dos dados antigos, revogar os vínculos que tenham sido expostos e planejar a limpeza do histórico com quem usa o repositório. Nenhum histórico foi reescrito e nenhum telefone real foi desconectado nesta alteração.
- **Mensagens:** somente texto de saída. Sem entrada por webhook, templates, mídia, confirmação de entrega ou fila automática. Tentativas sem confirmação ficam contabilizadas para impedir duplicação e estouro concorrente da franquia.
- **Contrato:** definir preço, franquia, suporte, responsabilidades, retenção e exportação de dados. Os 30 dias/1.000 mensagens iniciais são parâmetros de avaliação, não uma oferta de venda aprovada.

## Verificação local

Os scripts `test:tenant`, `test:auth`, `test:ui`, `test:commercial` e `test:commercial-ui` usam dados temporários/simulados. Cobrem isolamento, login/CSRF/CORS, chaves e revogação, vencimento/renovação, limites concorrentes, idempotência, venda com rollback, telas em diferentes larguras e erros no navegador. Não enviam mensagens reais e não substituem validação do provedor em produção.

Na correção do QR, também foi verificada a geração real do código e da imagem SVG com um perfil temporário do gerenciador e cache HTML desativado, sem conectar telefone nem enviar mensagens. A causa exata da falha no perfil anterior não foi confirmada. `test:whatsapp` verifica mensagens de erro e recuperação com backup por empresa; `test:auth` também cobre o botão de recuperação no navegador. A sessão real existente foi preservada.

## Como cadastrar um contratante

1. Criar o administrador com `npm run setup` se ainda não existir; executar `npm start` na pasta `whatsapp-api`.
2. Entrar e abrir **Lojas**. Cadastrar empresa, responsável e senha inicial.
3. Em **Editar mensalidade**, informar o contrato e o vencimento após verificar o pagamento.
4. O responsável entra com seu e-mail, troca a senha e conecta seu telefone em **WhatsApp**.
5. Em **API e plano**, gera a chave e usa os endpoints do próprio domínio, conforme [OpenAPI](openapi.json).
