# App Doces — Precificação de Produtos

Aplicativo mobile desenvolvido com **React Native + Expo** para cadastrar ingredientes, montar bases de receitas, criar produtos finais e calcular preços de venda considerando custos, margem de lucro e taxa de cartão.

## Objetivo

O app ajuda uma confeitaria a saber quanto custa produzir cada item e a definir um preço de venda sustentável.

Ele separa o processo em quatro etapas:

1. Cadastro de ingredientes.
2. Criação de bases de produção, como massas, recheios, caldas e sorvetes.
3. Montagem de produtos finais, incluindo bases proporcionais e custos extras.
4. Cálculo do preço ideal de venda.

## Tecnologias

- React Native
- Expo
- JavaScript
- AsyncStorage
- EAS Build para gerar APK Android

## Conceitos do sistema

### Ingredientes

São os produtos comprados para produzir, com preço, quantidade adquirida e unidade.

Exemplo:

```text
Ingrediente: Leite condensado
Preço pago: R$ 8,00
Quantidade comprada: 395 g
```

O aplicativo calcula o custo proporcional usado em cada base.

### Bases

Bases são preparos feitos em lote. Elas podem ser usadas por vários produtos.

Exemplos:

- Massa de chocolate
- Recheio de brigadeiro
- Ganache
- Calda
- Sorvete base
- Chantininho

Cada base possui:

- Nome
- Ingredientes usados
- Quantidade usada de cada ingrediente
- Rendimento final
- Unidade do rendimento: `un`, `g`, `kg`, `ml` ou `L`

Exemplo:

```text
Base: Massa de chocolate
Rendimento final: 3 kg
Custo total: R$ 45,00
Custo por kg: R$ 15,00
```

### Produtos

Produtos são os itens finais que serão vendidos ao cliente.

Um produto pode usar uma ou mais bases em quantidades proporcionais e também ter custos extras.

Exemplo:

```text
Produto: Bolo de chocolate 1 kg

Bases:
- Massa de chocolate: 1 kg
- Recheio de brigadeiro: 350 g
- Ganache: 200 g

Custos extras:
- Caixa: R$ 4,00
- Base dourada: R$ 2,00
- Decoração: R$ 10,00
- Mão de obra: R$ 20,00
```

Dessa forma, a mesma massa pode ser reaproveitada para produtos de tamanhos diferentes, como bolo de 500 g, 1 kg, 1,5 kg e 2 kg.

## Regras de cálculo

### Custo de ingrediente usado

```text
Custo usado = (preço pago / quantidade comprada) × quantidade usada
```

Exemplo:

```text
1 kg de farinha custa R$ 6,00
A receita usa 500 g

Custo da farinha na receita = R$ 3,00
```

### Custo de uma base

```text
Custo da base = soma dos custos de todos os ingredientes usados
```

### Custo proporcional de uma base no produto

```text
Custo proporcional =
(custo total da base / rendimento da base) × quantidade usada no produto
```

Exemplo:

```text
Massa custa R$ 45,00 e rende 3 kg
Custo por kg = R$ 15,00

Um bolo usa 1 kg da massa
Custo da massa no produto = R$ 15,00
```

O sistema converte automaticamente unidades compatíveis:

```text
1 kg = 1000 g
1 L = 1000 ml
```

Não é permitido comparar peso com volume:

```text
kg e g: compatíveis
L e ml: compatíveis
un: somente com un
kg e L: incompatíveis
```

### Custo total do produto

```text
Custo do produto =
componentes proporcionais + custos extras
```

Custos extras podem incluir:

- Embalagem
- Caixa
- Base/prato
- Topper
- Decoração
- Mão de obra
- Outros custos fixos

### Preço ideal de venda

```text
Preço ideal = custo total / (1 - margem de lucro - taxa de cartão)
```

Exemplo:

```text
Custo do produto: R$ 65,70
Margem desejada: 40%
Taxa da maquininha: 5%

Preço ideal = 65,70 / (1 - 0,40 - 0,05)
Preço ideal = R$ 119,45
```

## Armazenamento dos dados

Os dados são salvos localmente no aparelho com `AsyncStorage`.

São armazenados:

- Ingredientes
- Bases
- Produtos
- Margem de lucro
- Taxa da maquininha

Os dados continuam salvos ao fechar e abrir o app.

### Atenção

Os dados podem ser perdidos se:

- O aplicativo for desinstalado.
- Os dados do app forem apagados nas configurações do Android.
- O usuário trocar de celular sem backup/migração.

Ao instalar uma atualização por cima do aplicativo, os dados são preservados desde que o mesmo `android.package` seja mantido.

## Como executar em desenvolvimento

Instale as dependências, caso necessário:

```bash
npm install
```

Inicie o Expo:

```bash
npx expo start
```

Para limpar o cache do Expo:

```bash
npx expo start -c
```

Depois, abra o aplicativo **Expo Go** no Android e escaneie o QR Code mostrado no terminal.

## Como gerar APK Android

O APK é gerado pelo EAS Build.

```bash
eas build -p android --profile preview
```

Quando o build terminar:

1. Abra o link informado pelo terminal ou pelo painel da Expo.
2. Baixe o arquivo APK.
3. Envie o arquivo ao celular.
4. Instale o APK.

Para atualizar o app já instalado, mantenha o mesmo identificador Android no `app.json`:

```json
"package": "com.felipeao2205.precificalimpo"
```

Depois gere um novo APK e instale por cima do anterior. Isso preserva os dados armazenados localmente.

## Configurações importantes

### app.json

O arquivo define:

- Nome exibido no celular: `Rosana Doces`
- Ícone do aplicativo
- Splash screen
- Identificador Android
- Comportamento do teclado no Android

Exemplo de configuração importante:

```json
"android": {
  "package": "com.felipeao2205.precificalimpo",
  "softwareKeyboardLayoutMode": "resize"
}
```

### Ícones

Os arquivos de imagem ficam em `assets/`:

```text
logo_ro.png       # Ícone principal
teste_ro.png      # Camada frontal do ícone Android adaptável
mono_logo.png     # Versão monocromática do ícone Android
splash-icon.png   # Imagem da tela de abertura
favicon.png       # Ícone para a versão web
```

Alterações no ícone, splash, nome ou configurações do `app.json` exigem gerar um novo APK.

## Próximas melhorias possíveis

- Cadastro de embalagens como itens reutilizáveis.
- Cadastro de valor por hora de mão de obra.
- Cálculo automático de mão de obra usando tempo de produção.
- Taxa de entrega por pedido.
- Tela de orçamento para clientes.
- Histórico de preços e alterações de ingredientes.
- Exportação de orçamento em PDF ou imagem.
- Backup dos dados na nuvem com Supabase.
- Controle de estoque de ingredientes e embalagens.
- Categorias de produtos, como bolos, doces, sorvetes e kits.

## Fluxo recomendado de uso

```text
1. Cadastre os ingredientes comprados.
2. Crie as bases: massas, recheios, ganaches e caldas.
3. Informe o rendimento real de cada base.
4. Monte os produtos que serão vendidos.
5. Adicione bases proporcionais ao produto.
6. Inclua embalagem, decoração e mão de obra como custos extras.
7. Abra a aba Preço.
8. Escolha margem e taxa da maquininha.
9. Use o preço sugerido como referência para venda.
```
