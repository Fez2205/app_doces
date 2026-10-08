import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GR = '#E8789A';
const BL = '#E8789A';
const FUNDO = '#FFF5F8';
const BORDA = '#F0DDE4';
const CUSTO = '#6B4FA3';
const PRECO = '#C21872';
const ERRO = '#D64545';

const F = {
  g: ['m', 1],
  kg: ['m', 1000],
  ml: ['v', 1],
  L: ['v', 1000],
  un: ['u', 1],
};

const FAM = {
  m: ['g', 'kg'],
  v: ['ml', 'L'],
  u: ['un'],
};

const UNITS = Object.keys(F);
const num = value => parseFloat(String(value).replace(',', '.')) || 0;
const brl = value =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);

const uid = () => Math.random().toString(36).slice(2, 10);
const family = unit => F[unit]?.[0] || 'u';
const baseQty = (qty, unit) => num(qty) * (F[unit]?.[1] || 1);
const compatible = (a, b) => family(a) === family(b);

/* ---------- Cálculos de ingrediente e base ---------- */

const itemCost = (item, ingredients) => {
  const ingredient = ingredients.find(x => x.id === item.iid);
  if (!ingredient) return 0;

  const bought = baseQty(ingredient.qty, ingredient.unit);
  const used = baseQty(item.qty, item.unit);

  return bought > 0 ? (num(ingredient.price) / bought) * used : 0;
};

const baseTotalCost = (base, ingredients) =>
  (base.items || []).reduce((sum, item) => sum + itemCost(item, ingredients), 0);

const baseCostForQty = (base, qtyNeeded, unitNeeded, ingredients) => {
  if (!base || !compatible(base.yieldUnit, unitNeeded)) return 0;

  const yieldBase = baseQty(base.yield, base.yieldUnit);
  const requiredBase = baseQty(qtyNeeded, unitNeeded);
  const cost = baseTotalCost(base, ingredients);

  return yieldBase > 0 ? (cost / yieldBase) * requiredBase : 0;
};

/* ---------- Cálculos de produto ---------- */

const productBasesCost = (product, bases, ingredients) =>
  (product.components || []).reduce((sum, component) => {
    const base = bases.find(x => x.id === component.bid);
    return sum + baseCostForQty(base, component.qty, component.unit, ingredients);
  }, 0);

const productExtrasCost = product =>
  (product.extras || []).reduce((sum, extra) => sum + num(extra.value), 0);

const productTotalCost = (product, bases, ingredients) =>
  productBasesCost(product, bases, ingredients) + productExtrasCost(product);

const idealPrice = (cost, margin, fee) => {
  const divisor = 1 - (num(margin) + num(fee)) / 100;
  return divisor > 0 ? cost / divisor : null;
};

/* ---------- Componentes pequenos ---------- */

function Sel({ value, options, onChange, style }) {
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.k === value);

  return (
    <>
      <TouchableOpacity
        style={[s.input, s.sel, style]}
        activeOpacity={0.8}
        onPress={() => setOpen(true)}
      >
        <Text style={s.inTx}>
          {current ? current.l : 'Escolher'} ▾
        </Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <ScrollView style={s.selectSheet} keyboardShouldPersistTaps="handled">
            {options.map(option => (
              <TouchableOpacity
                key={option.k}
                style={s.opt}
                onPress={() => {
                  onChange(option.k);
                  setOpen(false);
                }}
              >
                <Text style={s.optTx}>{option.l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const Btn = ({ t, onPress, kind, style }) => (
  <TouchableOpacity
    style={[
      s.btn,
      kind === 'g' && s.btnG,
      kind === 'd' && s.btnD,
      style,
    ]}
    activeOpacity={0.8}
    onPress={onPress}
  >
    <Text
      style={[
        s.btnTx,
        kind === 'g' && s.btnGText,
        kind === 'd' && s.btnDText,
      ]}
    >
      {t}
    </Text>
  </TouchableOpacity>
);

const initialBase = () => ({
  id: '',
  name: '',
  yield: '',
  yieldUnit: 'un',
  items: [],
});

const initialProduct = () => ({
  id: '',
  name: '',
  components: [],
  extras: [],
});

/* ---------- App ---------- */

export default function App() {
  const [ing, setIng] = useState([]);
  const [bases, setBases] = useState([]);
  const [products, setProducts] = useState([]);
  const [pr, setPr] = useState({ pid: '', m: 30, t: 5 });
  const [ready, setReady] = useState(false);

  const [tab, setTab] = useState('ing');
  const [baseDraft, setBaseDraft] = useState(null);
  const [productDraft, setProductDraft] = useState(null);
  const [form, setForm] = useState(null);

  const baseScrollRef = useRef(null);
  const productScrollRef = useRef(null);

  /* ---------- Carregar dados ---------- */

  useEffect(() => {
    AsyncStorage.getItem('pd1')
      .then(raw => {
        if (!raw) return;

        const data = JSON.parse(raw);

        setIng(data.ing || []);

        /*
          Compatibilidade:
          as receitas antigas eram salvas em "rec" e rendiam unidades.
          Agora viram bases automaticamente.
        */
        const savedBases = data.bases || data.rec || [];
        setBases(
          savedBases.map(base => ({
            ...base,
            yieldUnit: base.yieldUnit || 'un',
            items: base.items || [],
          }))
        );

        setProducts(data.products || []);
        setPr(data.pr || { pid: '', m: 30, t: 5 });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  /* ---------- Salvar dados ---------- */

  useEffect(() => {
    if (!ready) return;

    AsyncStorage.setItem(
      'pd1',
      JSON.stringify({
        ing,
        bases,
        products,
        pr,
      })
    ).catch(() => {});
  }, [ing, bases, products, pr, ready]);

  /* ---------- Botão físico voltar ---------- */

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (form) {
          setForm(null);
          return true;
        }

        if (baseDraft) {
          setBaseDraft(null);
          return true;
        }

        if (productDraft) {
          setProductDraft(null);
          return true;
        }

        if (tab !== 'ing') {
          setTab('ing');
          return true;
        }

        return false;
      }
    );

    return () => subscription.remove();
  }, [form, baseDraft, productDraft, tab]);

  if (!ready) return <View style={s.root} />;

  /* ---------- Ingredientes ---------- */

  const saveIng = () => {
    const item = {
      name: form.name.trim(),
      price: num(form.price),
      qty: num(form.qty),
      unit: form.unit,
    };

    if (!item.name || item.price <= 0 || item.qty <= 0) {
      return Alert.alert('Atenção', 'Preencha nome, preço e quantidade.');
    }

    setIng(current =>
      form.id
        ? current.map(ingredient =>
            ingredient.id === form.id
              ? { ...ingredient, ...item }
              : ingredient
          )
        : [...current, { id: uid(), ...item }]
    );

    setForm(null);
  };

  const delIng = () => {
    const usedInBase = bases.some(base =>
      base.items.some(item => item.iid === form.id)
    );

    const message = usedInBase
      ? 'Este ingrediente é usado em bases. Ao excluir, ele será removido dessas bases. Deseja continuar?'
      : 'Excluir este ingrediente?';

    Alert.alert('Excluir ingrediente', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          setIng(current => current.filter(item => item.id !== form.id));

          if (usedInBase) {
            setBases(current =>
              current.map(base => ({
                ...base,
                items: base.items.filter(item => item.iid !== form.id),
              }))
            );
          }

          setForm(null);
        },
      },
    ]);
  };

  /* ---------- Bases ---------- */

  const saveBase = () => {
    if (!baseDraft.name.trim() || num(baseDraft.yield) <= 0) {
      return Alert.alert(
        'Atenção',
        'Informe o nome e o rendimento final da base.'
      );
    }

    if (!baseDraft.items.length) {
      return Alert.alert(
        'Atenção',
        'Adicione ao menos um ingrediente à base.'
      );
    }

    if (baseDraft.items.some(item => num(item.qty) <= 0)) {
      return Alert.alert(
        'Atenção',
        'Informe uma quantidade maior que zero para todos os ingredientes.'
      );
    }

    setBases(current =>
      baseDraft.id
        ? current.map(base => (base.id === baseDraft.id ? baseDraft : base))
        : [...current, { ...baseDraft, id: uid() }]
    );

    setBaseDraft(null);
  };

  const delBase = () => {
    const usedInProduct = products.some(product =>
      product.components.some(component => component.bid === baseDraft.id)
    );

    const message = usedInProduct
      ? 'Esta base é usada em produtos. Ao excluir, ela também será removida deles. Deseja continuar?'
      : 'Excluir esta base?';

    Alert.alert('Excluir base', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          setBases(current => current.filter(base => base.id !== baseDraft.id));

          if (usedInProduct) {
            setProducts(current =>
              current.map(product => ({
                ...product,
                components: product.components.filter(
                  component => component.bid !== baseDraft.id
                ),
              }))
            );
          }

          setBaseDraft(null);
        },
      },
    ]);
  };

  const updateBaseItem = (index, patch) => {
    setBaseDraft(current => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  };

  /* ---------- Produtos ---------- */

  const saveProduct = () => {
    if (!productDraft.name.trim()) {
      return Alert.alert('Atenção', 'Informe o nome do produto.');
    }

    if (!productDraft.components.length && !productDraft.extras.length) {
      return Alert.alert(
        'Atenção',
        'Adicione ao menos uma base ou um custo extra.'
      );
    }

    if (productDraft.components.some(component => num(component.qty) <= 0)) {
      return Alert.alert(
        'Atenção',
        'Informe uma quantidade maior que zero em todas as bases.'
      );
    }

    if (
      productDraft.extras.some(
        extra => !extra.name.trim() || num(extra.value) < 0
      )
    ) {
      return Alert.alert(
        'Atenção',
        'Preencha a descrição e o valor de todos os custos extras.'
      );
    }

    setProducts(current =>
      productDraft.id
        ? current.map(product =>
            product.id === productDraft.id ? productDraft : product
          )
        : [...current, { ...productDraft, id: uid() }]
    );

    setProductDraft(null);
  };

  const delProduct = () => {
    Alert.alert('Excluir produto', 'Excluir este produto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          setProducts(current =>
            current.filter(product => product.id !== productDraft.id)
          );

          if (pr.pid === productDraft.id) {
            setPr(current => ({ ...current, pid: '' }));
          }

          setProductDraft(null);
        },
      },
    ]);
  };

  const updateComponent = (index, patch) => {
    setProductDraft(current => ({
      ...current,
      components: current.components.map((component, componentIndex) =>
        componentIndex === index
          ? { ...component, ...patch }
          : component
      ),
    }));
  };

  const updateExtra = (index, patch) => {
    setProductDraft(current => ({
      ...current,
      extras: current.extras.map((extra, extraIndex) =>
        extraIndex === index ? { ...extra, ...patch } : extra
      ),
    }));
  };

  /* ---------- Editor de base ---------- */

  if (baseDraft) {
    const ingredientOptions = ing.map(item => ({
      k: item.id,
      l: item.name,
    }));

    return (
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={
          Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0
        }
      >
        <ScrollView
          ref={baseScrollRef}
          style={s.editorScroll}
          contentContainerStyle={s.editorContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.rowSpace}>
            <Btn t="← Voltar" kind="g" onPress={() => setBaseDraft(null)} />
            {baseDraft.id ? (
              <Btn t="Excluir" kind="d" onPress={delBase} />
            ) : null}
          </View>

          <Text style={s.h1}>
            {baseDraft.id ? 'Editar' : 'Nova'} base
          </Text>

          <Text style={s.lb}>Nome da base</Text>
          <TextInput
            style={s.input}
            value={baseDraft.name}
            placeholder="Ex: Massa de chocolate"
            onFocus={() =>
              baseScrollRef.current?.scrollTo({ y: 0, animated: true })
            }
            onChangeText={value =>
              setBaseDraft(current => ({ ...current, name: value }))
            }
          />

          <Text style={s.lb}>Rendimento final da base</Text>
          <View style={s.row}>
            <TextInput
              style={[s.input, s.flex2]}
              keyboardType="decimal-pad"
              value={String(baseDraft.yield)}
              placeholder="Ex: 3"
              onFocus={() =>
                baseScrollRef.current?.scrollTo({ y: 100, animated: true })
              }
              onChangeText={value =>
                setBaseDraft(current => ({ ...current, yield: value }))
              }
            />

            <Sel
              style={s.flex1}
              value={baseDraft.yieldUnit}
              options={UNITS.map(unit => ({ k: unit, l: unit }))}
              onChange={unit =>
                setBaseDraft(current => ({
                  ...current,
                  yieldUnit: unit,
                }))
              }
            />
          </View>

          <Text style={s.h2}>Ingredientes</Text>

          {baseDraft.items.map((item, index) => {
            const ingredient = ing.find(x => x.id === item.iid);
            const units = ingredient
              ? FAM[family(ingredient.unit)]
              : ['un'];

            return (
              <View key={`${item.iid}-${index}`} style={s.card}>
                <Sel
                  value={item.iid}
                  options={ingredientOptions}
                  onChange={id => {
                    const selected = ing.find(x => x.id === id);

                    updateBaseItem(index, {
                      iid: id,
                      unit: selected.unit,
                    });
                  }}
                />

                <View style={[s.row, s.mt8]}>
                  <TextInput
                    style={[s.input, s.flex2]}
                    keyboardType="decimal-pad"
                    value={String(item.qty)}
                    placeholder="Qtd usada"
                    onFocus={() =>
                      baseScrollRef.current?.scrollToEnd({ animated: true })
                    }
                    onChangeText={value =>
                      updateBaseItem(index, { qty: value })
                    }
                  />

                  <Sel
                    style={s.flex1}
                    value={item.unit}
                    options={units.map(unit => ({ k: unit, l: unit }))}
                    onChange={unit => updateBaseItem(index, { unit })}
                  />
                </View>

                <View style={[s.rowSpace, s.mt6]}>
                  <Text style={s.costText}>
                    {brl(itemCost(item, ing))}
                  </Text>

                  <Btn
                    t="Remover"
                    kind="d"
                    onPress={() =>
                      setBaseDraft(current => ({
                        ...current,
                        items: current.items.filter(
                          (_, itemIndex) => itemIndex !== index
                        ),
                      }))
                    }
                  />
                </View>
              </View>
            );
          })}

          <Btn
            t="+ Adicionar ingrediente"
            kind="g"
            onPress={() => {
              if (!ing.length) {
                return Alert.alert(
                  'Atenção',
                  'Cadastre ao menos um ingrediente primeiro.'
                );
              }

              const first = ing[0];

              setBaseDraft(current => ({
                ...current,
                items: [
                  ...current.items,
                  {
                    iid: first.id,
                    qty: '',
                    unit: first.unit,
                  },
                ],
              }));
            }}
          />
        </ScrollView>

        <View style={s.foot}>
          <View style={s.rowSpace}>
            <Text style={s.mu}>Custo total da base</Text>
            <Text style={s.b}>{brl(baseTotalCost(baseDraft, ing))}</Text>
          </View>

          <View style={s.rowSpace}>
            <Text style={s.mu}>
              Custo por {num(baseDraft.yield) || 0} {baseDraft.yieldUnit}
            </Text>
            <Text style={[s.b, s.pinkText]}>
              {brl(
                baseCostForQty(
                  baseDraft,
                  baseDraft.yield,
                  baseDraft.yieldUnit,
                  ing
                )
              )}
            </Text>
          </View>

          <Btn
            t="Salvar base"
            style={s.mt10}
            onPress={saveBase}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  /* ---------- Editor de produto ---------- */

  if (productDraft) {
    const baseOptions = bases.map(base => ({
      k: base.id,
      l: `${base.name} (${num(base.yield)} ${base.yieldUnit})`,
    }));

    return (
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={
          Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0
        }
      >
        <ScrollView
          ref={productScrollRef}
          style={s.editorScroll}
          contentContainerStyle={s.editorContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.rowSpace}>
            <Btn
              t="← Voltar"
              kind="g"
              onPress={() => setProductDraft(null)}
            />
            {productDraft.id ? (
              <Btn t="Excluir" kind="d" onPress={delProduct} />
            ) : null}
          </View>

          <Text style={s.h1}>
            {productDraft.id ? 'Editar' : 'Novo'} produto
          </Text>

          <Text style={s.lb}>Nome do produto</Text>
          <TextInput
            style={s.input}
            value={productDraft.name}
            placeholder="Ex: Bolo de chocolate 1 kg"
            onChangeText={value =>
              setProductDraft(current => ({ ...current, name: value }))
            }
          />

          <Text style={s.h2}>Bases usadas</Text>
          <Text style={s.help}>
            Informe quanto de cada massa, recheio, calda ou cobertura o produto usa.
          </Text>

          {productDraft.components.map((component, index) => {
            const base = bases.find(item => item.id === component.bid);
            const units = base
              ? FAM[family(base.yieldUnit)]
              : ['un'];

            return (
              <View key={`${component.bid}-${index}`} style={s.card}>
                <Sel
                  value={component.bid}
                  options={baseOptions}
                  onChange={id => {
                    const selected = bases.find(item => item.id === id);

                    updateComponent(index, {
                      bid: id,
                      unit: selected.yieldUnit,
                    });
                  }}
                />

                <View style={[s.row, s.mt8]}>
                  <TextInput
                    style={[s.input, s.flex2]}
                    keyboardType="decimal-pad"
                    value={String(component.qty)}
                    placeholder="Qtd usada"
                    onFocus={() =>
                      productScrollRef.current?.scrollToEnd({
                        animated: true,
                      })
                    }
                    onChangeText={value =>
                      updateComponent(index, { qty: value })
                    }
                  />

                  <Sel
                    style={s.flex1}
                    value={component.unit}
                    options={units.map(unit => ({ k: unit, l: unit }))}
                    onChange={unit => updateComponent(index, { unit })}
                  />
                </View>

                <View style={[s.rowSpace, s.mt6]}>
                  <Text style={s.costText}>
                    {brl(
                      baseCostForQty(
                        base,
                        component.qty,
                        component.unit,
                        ing
                      )
                    )}
                  </Text>

                  <Btn
                    t="Remover"
                    kind="d"
                    onPress={() =>
                      setProductDraft(current => ({
                        ...current,
                        components: current.components.filter(
                          (_, componentIndex) => componentIndex !== index
                        ),
                      }))
                    }
                  />
                </View>
              </View>
            );
          })}

          <Btn
            t="+ Adicionar base"
            kind="g"
            onPress={() => {
              if (!bases.length) {
                return Alert.alert(
                  'Atenção',
                  'Cadastre ao menos uma base primeiro.'
                );
              }

              const first = bases[0];

              setProductDraft(current => ({
                ...current,
                components: [
                  ...current.components,
                  {
                    bid: first.id,
                    qty: '',
                    unit: first.yieldUnit,
                  },
                ],
              }));
            }}
          />

          <Text style={s.h2}>Custos extras</Text>
          <Text style={s.help}>
            Adicione embalagem, caixa, base, decoração, mão de obra ou qualquer outro custo fixo deste produto.
          </Text>

          {productDraft.extras.map((extra, index) => (
            <View key={extra.id || `extra-antigo-${index}`} style={s.card}>
              <Text style={s.lb}>Descrição</Text>
              <TextInput
                style={s.input}
                value={extra.name}
                placeholder="Ex: Caixa, decoração ou mão de obra"
                onChangeText={value => updateExtra(index, { name: value })}
              />

              <Text style={s.lb}>Valor (R$)</Text>
              <View style={[s.rowSpace, s.mt4]}>
                <TextInput
                  style={[s.input, s.flex1]}
                  keyboardType="decimal-pad"
                  value={String(extra.value)}
                  placeholder="0,00"
                  onChangeText={value =>
                    updateExtra(index, { value })
                  }
                />

                <Btn
                  t="Remover"
                  kind="d"
                  onPress={() =>
                    setProductDraft(current => ({
                      ...current,
                      extras: current.extras.filter(
                        (_, extraIndex) => extraIndex !== index
                      ),
                    }))
                  }
                />
              </View>
            </View>
          ))}

          <Btn
            t="+ Adicionar custo extra"
            kind="g"
            onPress={() =>
              setProductDraft(current => ({
                ...current,
                extras: [
                  ...current.extras,
                  { id: uid(), name: '', value: '' },
                ],
              }))
            }
          />
        </ScrollView>

        <View style={s.foot}>
          <View style={s.rowSpace}>
            <Text style={s.mu}>Bases</Text>
            <Text style={s.b}>
              {brl(productBasesCost(productDraft, bases, ing))}
            </Text>
          </View>

          <View style={s.rowSpace}>
            <Text style={s.mu}>Custos extras</Text>
            <Text style={s.b}>{brl(productExtrasCost(productDraft))}</Text>
          </View>

          <View style={s.rowSpace}>
            <Text style={s.mu}>Custo total do produto</Text>
            <Text style={[s.b, s.pinkText]}>
              {brl(productTotalCost(productDraft, bases, ing))}
            </Text>
          </View>

          <Btn
            t="Salvar produto"
            style={s.mt10}
            onPress={saveProduct}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  /* ---------- Tela de preço ---------- */

  const selectedProduct =
    products.find(product => product.id === pr.pid) || products[0];

  const productCost = selectedProduct
    ? productTotalCost(selectedProduct, bases, ing)
    : 0;

  const price = selectedProduct
    ? idealPrice(productCost, pr.m, pr.t)
    : null;

  const stepper = (key, label) => (
    <View style={s.card}>
      <Text style={s.lb}>{label}</Text>

      <View style={s.row}>
        <Btn
          t="−"
          kind="g"
          style={s.stepBtn}
          onPress={() =>
            setPr(current => ({
              ...current,
              [key]: Math.max(0, num(current[key]) - 1),
            }))
          }
        />

        <TextInput
          style={[s.input, s.stepInput]}
          keyboardType="decimal-pad"
          value={String(pr[key])}
          onChangeText={value =>
            setPr(current => ({
              ...current,
              [key]: num(value),
            }))
          }
        />

        <Btn
          t="+"
          kind="g"
          style={s.stepBtn}
          onPress={() =>
            setPr(current => ({
              ...current,
              [key]: num(current[key]) + 1,
            }))
          }
        />
      </View>
    </View>
  );

  const openAdd = () => {
    if (tab === 'ing') {
      setForm({ id: '', name: '', price: '', qty: '', unit: 'g' });
      return;
    }

    if (tab === 'base') {
      if (!ing.length) {
        Alert.alert('Atenção', 'Cadastre ao menos um ingrediente primeiro.');
        setTab('ing');
        return;
      }

      setBaseDraft(initialBase());
      return;
    }

    if (tab === 'product') {
      if (!bases.length) {
        Alert.alert('Atenção', 'Cadastre ao menos uma base primeiro.');
        setTab('base');
        return;
      }

      setProductDraft(initialProduct());
    }
  };

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.mainContent}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'ing' && (
          <>
            <Text style={s.h1}>Meus Ingredientes</Text>

            {!ing.length ? (
              <Text style={s.empty}>
                Nenhum ingrediente ainda.{'\n'}Toque no + para começar.
              </Text>
            ) : (
              ing.map(ingredient => (
                <TouchableOpacity
                  key={ingredient.id}
                  style={s.card}
                  onPress={() =>
                    setForm({
                      ...ingredient,
                      price: String(ingredient.price),
                      qty: String(ingredient.qty),
                    })
                  }
                >
                  <Text style={s.b}>{ingredient.name}</Text>
                  <Text style={s.mu}>
                    {brl(num(ingredient.price))} / {num(ingredient.qty)}{' '}
                    {ingredient.unit}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {tab === 'base' && (
          <>
            <Text style={s.h1}>Minhas Bases</Text>

            {!bases.length ? (
              <Text style={s.empty}>
                Nenhuma base ainda.{'\n'}Cadastre massa, recheio, calda ou sorvete.
              </Text>
            ) : (
              bases.map(base => (
                <TouchableOpacity
                  key={base.id}
                  style={s.card}
                  onPress={() =>
                    setBaseDraft(JSON.parse(JSON.stringify(base)))
                  }
                >
                  <Text style={s.b}>{base.name}</Text>
                  <Text style={s.mu}>
                    Rende {num(base.yield)} {base.yieldUnit} · Custo total{' '}
                    {brl(baseTotalCost(base, ing))}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {tab === 'product' && (
          <>
            <Text style={s.h1}>Meus Produtos</Text>

            {!products.length ? (
              <Text style={s.empty}>
                Nenhum produto ainda.{'\n'}Toque no + para montar um produto para venda.
              </Text>
            ) : (
              products.map(product => (
                <TouchableOpacity
                  key={product.id}
                  style={s.card}
                  onPress={() =>
                    setProductDraft(JSON.parse(JSON.stringify(product)))
                  }
                >
                  <Text style={s.b}>{product.name}</Text>
                  <Text style={s.mu}>
                    Custo total {brl(productTotalCost(product, bases, ing))}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {tab === 'price' && (
          <>
            <Text style={s.h1}>Calculadora de Preço</Text>

            {!selectedProduct ? (
              <Text style={s.empty}>
                Crie um produto primeiro.
              </Text>
            ) : (
              <>
                <Text style={s.lb}>Produto</Text>

                <Sel
                  value={selectedProduct.id}
                  options={products.map(product => ({
                    k: product.id,
                    l: product.name,
                  }))}
                  onChange={id =>
                    setPr(current => ({ ...current, pid: id }))
                  }
                />

                <View style={[s.big, s.costCard]}>
                  <Text style={s.costTitle}>Custo real do produto</Text>
                  <Text style={s.costValue}>{brl(productCost)}</Text>
                </View>

                {stepper('m', 'Margem de lucro desejada (%)')}
                {stepper('t', 'Taxa da maquininha de cartão (%)')}

                <View style={[s.big, s.priceCard]}>
                  <Text style={s.priceTitle}>PREÇO IDEAL DE VENDA</Text>

                  {price === null ? (
                    <Text style={s.errorText}>
                      Margem + taxa deve ser menor que 100%
                    </Text>
                  ) : (
                    <Text style={s.priceValue}>{brl(price)}</Text>
                  )}

                  {price !== null ? (
                    <Text style={s.mu}>
                      Lucro {brl((price * pr.m) / 100)} · Taxa{' '}
                      {brl((price * pr.t) / 100)}
                    </Text>
                  ) : null}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {tab !== 'price' && (
        <TouchableOpacity style={s.fab} activeOpacity={0.8} onPress={openAdd}>
          <Text style={s.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <View style={s.nav}>
        {[
          ['ing', '🥛', 'Ingredientes'],
          ['base', '📖', 'Bases'],
          ['product', '🧁', 'Produtos'],
          ['price', '💰', 'Preço'],
        ].map(([key, icon, label]) => (
          <TouchableOpacity
            key={key}
            style={s.navB}
            activeOpacity={0.8}
            onPress={() => setTab(key)}
          >
            <Text style={s.navIcon}>{icon}</Text>
            <Text
              style={[
                s.navText,
                tab === key && s.navTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Modal de ingrediente */}
      <Modal
        visible={!!form}
        transparent
        animationType="slide"
        onRequestClose={() => setForm(null)}
      >
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={
            Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0
          }
        >
          {form && (
            <ScrollView
              style={s.sheet}
              contentContainerStyle={s.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.h1}>
                {form.id ? 'Editar' : 'Novo'} ingrediente
              </Text>

              <Text style={s.lb}>Nome</Text>
              <TextInput
                style={s.input}
                value={form.name}
                placeholder="Ex: Leite condensado"
                onChangeText={value =>
                  setForm(current => ({ ...current, name: value }))
                }
              />

              <Text style={s.lb}>Preço pago (R$)</Text>
              <TextInput
                style={s.input}
                keyboardType="decimal-pad"
                value={form.price}
                placeholder="0,00"
                onChangeText={value =>
                  setForm(current => ({ ...current, price: value }))
                }
              />

              <View style={s.row}>
                <View style={s.flex1}>
                  <Text style={s.lb}>Quantidade comprada</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="decimal-pad"
                    value={form.qty}
                    placeholder="0"
                    onChangeText={value =>
                      setForm(current => ({ ...current, qty: value }))
                    }
                  />
                </View>

                <View style={s.flex1}>
                  <Text style={s.lb}>Unidade</Text>
                  <Sel
                    value={form.unit}
                    options={UNITS.map(unit => ({ k: unit, l: unit }))}
                    onChange={unit =>
                      setForm(current => ({ ...current, unit }))
                    }
                  />
                </View>
              </View>

              <View style={[s.row, s.mt16]}>
                <Btn
                  t="Cancelar"
                  kind="g"
                  style={s.flex1}
                  onPress={() => setForm(null)}
                />

                <Btn
                  t="Salvar"
                  style={s.flex1}
                  onPress={saveIng}
                />
              </View>

              {form.id ? (
                <Btn
                  t="Excluir ingrediente"
                  kind="d"
                  onPress={delIng}
                />
              ) : null}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FUNDO,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 50,
  },

  mainContent: {
    padding: 16,
    paddingBottom: 115,
  },

  editorScroll: {
    flex: 1,
  },

  editorContent: {
    padding: 16,
    paddingBottom: 190,
  },

  h1: {
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 12,
    color: '#1B1F23',
  },

  h2: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 6,
    color: '#1B1F23',
  },

  lb: {
    fontSize: 14,
    color: '#6B7480',
    marginTop: 10,
    marginBottom: 4,
  },

  mu: {
    fontSize: 14,
    color: '#6B7480',
  },

  help: {
    color: '#6B7480',
    fontSize: 14,
    marginBottom: 10,
  },

  b: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1F23',
  },

  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },

  rowSpace: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  flex1: {
    flex: 1,
  },

  flex2: {
    flex: 2,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDA,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },

  input: {
    minHeight: 54,
    fontSize: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDA,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#1B1F23',
  },

  sel: {
    justifyContent: 'center',
  },

  inTx: {
    fontSize: 18,
    color: '#1B1F23',
  },

  btn: {
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: 18,
    backgroundColor: GR,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnG: {
    backgroundColor: '#FCE8EF',
  },

  btnD: {
    backgroundColor: 'transparent',
  },

  btnTx: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  btnGText: {
    color: BL,
  },

  btnDText: {
    color: ERRO,
  },

  big: {
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 12,
  },

  costCard: {
    backgroundColor: '#EEE8F8',
  },

  costTitle: {
    color: CUSTO,
    fontSize: 17,
  },

  costValue: {
    color: CUSTO,
    fontSize: 34,
    fontWeight: '800',
  },

  priceCard: {
    backgroundColor: '#FFDCEB',
  },

  priceTitle: {
    color: PRECO,
    fontWeight: '800',
  },

  priceValue: {
    color: PRECO,
    fontSize: 44,
    fontWeight: '800',
  },

  errorText: {
    color: ERRO,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },

  costText: {
    color: BL,
    fontWeight: '700',
    fontSize: 18,
  },

  pinkText: {
    color: BL,
  },

  empty: {
    textAlign: 'center',
    color: '#6B7480',
    padding: 40,
    fontSize: 16,
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: GR,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },

  fabText: {
    color: '#FFFFFF',
    fontSize: 34,
  },

  nav: {
    flexDirection: 'row',
    backgroundColor: FUNDO,
    borderTopWidth: 1,
    borderTopColor: BORDA,
    paddingBottom: 14,
  },

  navB: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },

  navIcon: {
    fontSize: 20,
  },

  navText: {
    color: '#6B7480',
    fontSize: 13,
  },

  navTextActive: {
    color: GR,
    fontWeight: '700',
  },

  foot: {
    backgroundColor: FUNDO,
    borderTopWidth: 1,
    borderTopColor: BORDA,
    padding: 16,
    paddingBottom: 24,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.45)',
    justifyContent: 'flex-end',
  },

  sheet: {
    backgroundColor: FUNDO,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },

  selectSheet: {
    backgroundColor: FUNDO,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },

  sheetContent: {
    padding: 18,
    paddingBottom: 180,
  },

  opt: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: BORDA,
  },

  optTx: {
    fontSize: 18,
    color: '#1B1F23',
  },

  stepBtn: {
    width: 64,
  },

  stepInput: {
    flex: 1,
    textAlign: 'center',
  },

  mt4: {
    marginTop: 4,
  },

  mt6: {
    marginTop: 6,
  },

  mt8: {
    marginTop: 8,
  },

  mt10: {
    marginTop: 10,
  },

  mt16: {
    marginTop: 16,
  },
});