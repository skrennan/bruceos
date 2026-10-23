# Produto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O público principal são assistências técnicas e lojas de celulares. O sistema atende o trabalho de balcão e a gestão da loja. O usuário confirmou esse foco durante o Impeccable init.

Existe também uma central do proprietário da plataforma para empresas contratantes, acessos e mensalidades. Essa central é secundária em relação à gestão da loja na revisão atual. Cada contratante possui ambiente próprio e conecta o WhatsApp da empresa.

## Product Purpose

Ser um sistema completo para assistências e lojas de celulares, com WhatsApp integrado. O núcleo reúne vendas, caixa, estoque, clientes, ordens de serviço e resultados.

Neste projeto, “administrativo” significa prioritariamente a gestão da loja: vendas, caixa, estoque, clientes, OS e resultados. Não interpretar esse termo apenas como a central de empresas, planos e mensalidades.

## Operating Context

O PDV apoia a venda de produtos e acessórios no balcão; a oficina acompanha reparos por ordens de serviço. A gestão consulta movimentações, estoque e resultados. O WhatsApp integra a comunicação da loja com os clientes. O sistema deve funcionar tanto no celular quanto no computador, conforme solicitação explícita do usuário.

## Capabilities and Constraints

HTML, CSS e JavaScript sem framework; backend Express, SQLite e whatsapp-web.js. Preservar dados e autenticação legados. Login por cookie e CSRF; integrações por chave restrita à empresa. Um processo do backend com disco persistente e um Chromium por WhatsApp conectado.

Preservar os fluxos funcionais de venda, impressão, estoque, caixa, clientes, OS e comunicação ao redesenhar a interface. Não introduzir dados fictícios em indicadores de operação.

## Product Principles

- Priorizar a operação e a gestão da loja; a administração comercial da plataforma é uma área distinta.
- Organizar o PDV para vender e o administrativo para acompanhar e administrar o negócio.
- Manter o funcionamento no celular e no computador.
- Calcular indicadores a partir dos registros reais e distinguir contratos de pagamentos recebidos.
- Preservar os dados e as regras do sistema funcional durante mudanças de interface.

## User Feedback and Design Status

O usuário rejeitou expressamente a primeira revisão visual por considerá-la genérica e com aparência de interface feita por IA. O DESIGN.md existente descreve essa implementação, mas não representa aprovação do usuário para manter sua identidade. Uma próxima revisão deve partir de uma nova proposta de design, considerando o pedido original de uma interface bonita, colorida, estilosa e com efeitos funcionais. O site do Taste foi indicado pelo usuário como referência; isso não estabelece uma paleta ou tipografia obrigatória.

## Open Decisions

Nome comercial definitivo, preços e franquias definitivos, gateway de pagamento, domínio, infraestrutura, política de suporte e adoção da API oficial da Meta não foram definidos. A cobrança inicial é manual. Não inventar clientes, faturamento, comprovantes de pagamento ou disponibilidade de produção.

## Evidence on Hand

Implementação existente e testes locais. Não há evidência de operação pública ou validação de várias conexões reais de WhatsApp.
