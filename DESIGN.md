---
name: Bruce Cell — estação de balcão
description: Gestão de assistência e venda com jade, navegação verde profunda e superfícies claras.
colors:
  primary: "#12674f"
  primary-hover: "#0b523f"
  primary-soft: "#dff1e7"
  navigation: "#213c31"
  canvas: "#f3f5f2"
  surface: "#fff"
  soft: "#edf1ed"
  ink: "#25362f"
  muted: "#63736b"
  line: "#dce4dd"
  financial: "#d8ecde"
  warning: "#9b6a16"
  danger: "#b23d42"
typography:
  headline:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-.035em"
  title:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 750
    lineHeight: 1.4
  body:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  metric:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "29px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-.035em"
rounded:
  field: "8px"
  button: "9px"
  product: "13px"
  panel: "14px"
  receipt: "15px"
spacing:
  compact: "8px"
  small: "12px"
  regular: "20px"
  receipt: "22px"
  large: "24px"
  panel: "25px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "10px 17px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "11px 18px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "11px 13px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  product:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.product}"
    padding: "9px 9px 17px"
  receipt:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.receipt}"
    padding: "{spacing.receipt}"
---

# Design System: Bruce Cell — estação de balcão

## Overview

**Creative North Star: "Estação de balcão"**

Uma interface para o ritmo da loja de celulares: vender, acompanhar reparos e consultar o negócio. A navegação verde profunda enquadra superfícies claras; jade identifica ações, enquanto símbolos de acessórios e estados trazem cor com função.

Este registro descreve a implementação atual, sem presumir aprovação visual do usuário. A revisão azul anterior foi rejeitada. A identidade atual alcança operação, login, conta, integrações e central de empresas.

**Key Characteristics:**

- Navegação verde profunda e superfícies claras.
- Manrope local e valores financeiros tabulares.
- Símbolos geométricos por tipo de acessório.
- Venda como comprovante e gestão com filas reais.
- Tema escuro e vistas adaptadas ao celular.

Autoridade: bruce.css, carregado por último nas cinco páginas HTML. dashboard.css, account.css e commercial.css fornecem bases; suas identidades antigas não são variantes atuais. oficina.css não está vinculado.

## Colors

### Primary

Jade de ação (primary e primary-hover) em botões; jade suave (primary-soft) nas seleções. Verde de navegação (navigation) na lateral e no cabeçalho da central, com destino ativo em menta clara.

### Secondary

Menta financeira (financial) destaca o primeiro indicador; o total usa uma variação clara local. Âmbar e vermelho comunicam atenção e problemas com texto. Capas, carregadores, cabos, áudio e películas recebem fundos pastéis próprios; não substituem o jade nas ações.

### Neutral

canvas envolve surface e soft; ink e muted separam leitura principal de metadados; line organiza limites. O modo escuro troca fundos, superfícies, texto e divisores; ações sólidas conservam jade e branco.

**The Cor com função Rule.** Cor acompanha rótulos e valores; gráficos não dependem somente da diferença entre tons.

## Typography

Manrope variável local com Segoe UI e sans-serif de reserva. Fonte e licença OFL ficam em assets/fonts/. Exemplos técnicos preservam fonte monoespaçada da base.

Headline identifica páginas e reduz a 27px na operação móvel. Title tem variações de 17–20px por seção. Body rege a interface; campos e botões usam 13px, tabelas 12px e metadados 11px. Indicadores financeiros usam metric, reduzidos a 25px no celular; o total móvel usa 31px.

**The Dinheiro legível Rule.** Valores financeiros e contagens usam numerais tabulares, com peso e alinhamento estáveis.

## Layout

Operação: lateral fixa de 240px, área principal com 32px laterais e barra superior de 74px. Painéis têm 25px internos. Gestão usa grade 1.25fr/1fr e intervalo de 22px; indicadores têm três colunas.

PDV: catálogo flexível e comprovante de 365px, intervalo de 25px e três colunas de produtos. Acima de 1700px são quatro colunas e comprovante de 400px. Até 1250px a lateral tem 216px e o catálogo duas colunas. De 761px a 1050px a lateral tem 190px, gestão empilha e catálogo/venda alternam como vistas com atalho fixo de total.

Até 760px o menu recolhe a navegação; conteúdo tem 17px laterais, indicadores empilham e produtos mantêm duas colunas. Catálogo e venda alternam como vistas. O atalho fixo respeita a área segura e tem espaço reservado. OS e relatórios viram registros empilhados; tabelas restantes permitem rolagem quando necessário.

Login usa duas colunas no desktop e uma no celular. Conta, integrações e central preservam sua organização com a mesma fonte, paleta, controles e foco.

## Elevation & Depth

Painéis são planos, com bordas finas e separação tonal. Produto recebe sombra discreta no hover; menus, diálogo, toast e atalho móvel usam sombra para indicar sobreposição.

**The Elevação de sobreposição Rule.** Não transferir sombras de menus e diálogos aos painéis de dados.

Estados transitam em .18s ease; barras em .25s ease-out. O pressionamento reduz o símbolo do produto para .94. Movimento reduzido remove animações, transições e rolagem suave.

## Shapes

Campos têm cantos menores que painéis. Produtos usam product, painéis panel e comprovante receipt. Badges usam 5px; indicadores de adição são circulares. Símbolos de acessórios são SVG geométricos; não há novos rasters.

## Components

### Buttons

Jade e branco para ação principal; secundários brancos com borda. Botões gerais têm altura mínima de 44px; finalizar venda ocupa a largura e tem 53px. Desabilitado usa opacidade .5. Foco tem contorno de 3px com afastamento de 3px.

### Chips

Categorias usam seleção jade suave. OS combina texto e fundo: análise âmbar, reparo azul esverdeado, pronto verde e entregue neutro. Resumos mostram contagens e seleção por sublinhado.

### Cards / Containers

Painéis brancos sem sombra. Produto é um botão completo com símbolo, nome, estoque e preço; indisponibilidade desabilita a seleção. Filas de gestão usam divisores, valores alinhados e ações explícitas.

### Inputs / Fields

Altura mínima de 46px, rótulo visível, fundo de superfície e borda de divisor. Foco muda borda e contorno. Busca do catálogo tem 50px e ícone SVG; seu indicador de teclado some no celular.

### Navigation

Ícones SVG e texto na lateral, destino ativo menta e ações de conta recolhidas. No celular os destinos abrem em duas colunas. Conta e integrações têm navegação própria na identidade comum.

### Comprovante e gestão

Comprovante sticky a 22px no desktop, linhas com quantidade editável, total tonal e pagamento antes da finalização. Celular tem vista própria e quantidades com alvo de 44px.

Gestão exibe aparelhos prontos e produtos com estoque até três unidades. Barras de etapas e faturamento por pagamento vêm de registros reais. A central diferencia mensalidade contratada de pagamento recebido. Vazios explicam a ausência de dados.

## Do's and Don'ts

### Do:

- **Do** aplicar a mesma identidade a operação, autenticação, conta, integrações e central.
- **Do** acompanhar gráficos e estados com texto e valores reais.
- **Do** manter foco visível, movimento reduzido e acesso direto à venda no celular.
- **Do** identificar capturas com fixtures como demonstrações, sem tratá-las como produção.

### Don't:

- **Don't** recuperar a identidade azul rejeitada ou o cobre antigo como variantes atuais.
- **Don't** inventar faturamento, séries históricas ou clientes para preencher indicadores.
- **Don't** propagar sombras de sobreposição para todos os painéis.
- **Don't** alterar regras de autenticação, estoque, pagamento ou impressão ao ampliar o visual.

Não canonizado: estilos legados continuam na cascata; categorias e ações auxiliares abaixo de 44px e metadados densos de 11px são limitações locais, não padrões para novas superfícies. Capturas de demonstração usam fixtures temporários.
