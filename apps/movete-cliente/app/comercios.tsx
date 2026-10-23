import React,{useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import type {ClientExperience,ClientSnapshot} from '../src/domain/client-experience.mjs';
import {prepareCatalogBranchLookup} from '../src/domain/catalog-branch-lookup.mjs';
const categories=[
 ['Supermercados','Sucursales, stock y precios confirmados por servidor.'],
 ['Restaurantes','Menú, preparación, entrega y cancelaciones.'],
 ['Farmacias OTC','Solo productos sin receta habilitados por la normativa.'],
 ['Otros comercios','Categorías autorizadas por zona y por sucursal.']
] as const;
export default function Commerce(){
 const {client,view}=useClientView();
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.heroText}>Comercios</Text>
   <Text style={styles.heroSub}>Compras y entregas con precio y disponibilidad confirmados por el servidor.</Text></View>
  {!view.commerce.catalogReadReady&&<Panel>
   <Text accessibilityRole="header" style={styles.heading}>Integración de catálogo requerida</Text>
   <Text style={styles.text}>El carrito productivo ya exige catálogo versionado, stock y precios del servidor. La compra permanece bloqueada porque el contrato actual aún no publica el catálogo para compradores ni una confirmación tipada de pedido.</Text>
   <Text style={styles.small}>Nunca se mostrarán productos ficticios ni se enviará un pedido con precios o stock vencidos.</Text>
  </Panel>}
  {view.authenticated&&view.commerce.catalogReadReady&&
   <CertifiedCatalog key={view.privateViewRevision} client={client} view={view}/>}
  {view.authenticated&&view.commercePager.readReady&&
   <ReadOnlyCatalogPager key={'pager-'+view.privateViewRevision} client={client} view={view}/>}
  {categories.map(([title,description])=><Panel key={title}>
   <Text accessibilityRole="header" style={styles.heading}>{title}</Text><Text style={styles.text}>{description}</Text>
   <Text style={styles.small}>Se habilitará únicamente con sucursal, cobertura y catálogo vigentes del servidor.</Text>
  </Panel>)}
 </ScrollView>;
}

/** No presenta productos ni precios mientras falte el GET certificado de A.
 * Los ítems mostrados proceden exclusivamente del flujo de catálogo autorizado.
 */
function CertifiedCatalog({client,view}:{client:ClientExperience;view:ClientSnapshot}){
 const commerce=view.commerce;
 const [branchInput,setBranchInput]=useState('');
 const [message,setMessage]=useState('');
 const [loading,setLoading]=useState(false);
 const busy=commerce.catalogLoading||loading;
 const clearMessage=()=>setMessage('');
 const load=async(branchOverride?:string)=>{
  if(busy)return;
  const branch=prepareCatalogBranchLookup(branchOverride??branchInput);
  if(!branch.ok){setMessage('Ingresá un identificador válido de una sucursal autorizada.');return;}
  setLoading(true);setMessage('');
  try{
   const result=await client.loadCommerceCatalog(branch.branchId);
   setMessage(result.ok?'Catálogo validado por el servidor. Precio y stock sujetos a actualización.':
    'No se pudo verificar la sucursal o el catálogo. No se conservarán precios sin validación.');
  }finally{setLoading(false);}
 };
 const fresh=commerce.stage==='SERVER_CATALOG'&&!commerce.catalogLoading;
 const summary=commerce.estimatedSubtotalPyg===null?'—'
  :commerce.estimatedSubtotalPyg.toLocaleString('es-PY')+' Gs.';
 const edit=(id:string,quantity:number)=>{
  client.setCommerceQuantity(id,quantity);
 };
 return <Panel>
  <Text accessibilityRole="header" style={styles.heading}>Carrito del catálogo autorizado</Text>
  <Text style={styles.small}>Esta vista solo usa catálogo versionado y vigente de una sucursal autorizada. No representa reserva de stock, tarifa de envío, pago ni pedido confirmado.</Text>
  <Text style={styles.text}>Código de sucursal autorizada</Text>
  <TextInput style={styles.field} autoCapitalize="none" autoCorrect={false}
   value={branchInput} onChangeText={value=>{setBranchInput(value);clearMessage();}}
   maxLength={36} editable={!busy}
   placeholder="Identificador de sucursal" accessibilityLabel="Identificador de sucursal autorizada"/>
  <Text style={styles.small}>Este código técnico es temporal: la lista pública de sucursales dependerá del contrato de descubrimiento del backend. No ingreses nombres ni datos personales.</Text>
  <Action label={busy?'Consultando catálogo…':'Consultar sucursal en servidor'}
   disabled={busy} busy={busy} onPress={()=>void load()}/>
  {commerce.catalogError&&<Text accessibilityRole="alert" style={styles.text}>
   El servidor no confirmó un catálogo vigente. No se presentarán precios obsoletos.
  </Text>}
  {message!==''&&<Text accessibilityRole="alert" style={styles.text}>{message}</Text>}
  {!fresh?(busy?<Text accessibilityLiveRegion="polite" style={styles.text}>
   Verificando en servidor la sucursal, sus precios y su stock. El catálogo anterior permanece oculto.
  </Text>:<Text accessibilityRole="alert" style={styles.text}>
   Catálogo no disponible o vencido. No se muestran precios ni productos sin validación del servidor.
  </Text>):<>
   <Text style={styles.small}>Sucursal: {commerce.branchId}. Versión de catálogo: {commerce.catalogVersion}. Precios en guaraníes del último snapshot; sujetos a cambio.</Text>
   <Action label="Actualizar precios y stock de esta sucursal" secondary disabled={busy}
    onPress={()=>{const branch=commerce.branchId;if(branch){
     setBranchInput(branch);void load(branch);
    }}}/>
   {commerce.catalogItems.filter(item=>item.active).map(item=>{
    const count=commerce.items.find(row=>row.itemId===item.itemId)?.quantity??0;
    return <View key={item.itemId} style={styles.card}>
     <Text style={styles.heading}>{item.itemTag.replaceAll('_',' ')}</Text>
     <Text style={styles.text}>{item.itemClass==='PHARMACY_OTC'?'Farmacia sin receta':'Artículo general'}</Text>
     <Text style={styles.text}>{item.unitPricePyg.toLocaleString('es-PY')} Gs. · Stock informado: {item.stockUnits}</Text>
     <Text style={styles.text}>Cantidad seleccionada: {count}</Text>
     <Action label={'Agregar una unidad de '+item.itemTag.replaceAll('_',' ')}
      disabled={busy||count>=item.stockUnits||count>=999}
      onPress={()=>edit(item.itemId,count+1)}/>
     <Action label={'Quitar una unidad de '+item.itemTag.replaceAll('_',' ')}
      secondary disabled={busy||count===0} onPress={()=>edit(item.itemId,count-1)}/>
    </View>;
   })}
   <Text accessibilityRole="header" style={styles.heading}>Entrega preferida</Text>
   <Action label="Moto de carga" selected={commerce.vehicleKind==='MOTO'}
    secondary={commerce.vehicleKind!=='MOTO'}
    disabled={busy} onPress={()=>client.selectCommerceVehicle('MOTO')}/>
   <Action label="Automóvil de carga" selected={commerce.vehicleKind==='AUTO'}
    secondary={commerce.vehicleKind!=='AUTO'}
    disabled={busy} onPress={()=>client.selectCommerceVehicle('AUTO')}/>
   <Text accessibilityRole="header" style={styles.heading}>
    Subtotal estimado: {summary}
   </Text>
   <Text style={styles.small}>No incluye envío, descuentos, comisiones ni cobro. Solo el backend puede emitir el total final y reservar inventario.</Text>
   <Action label="Vaciar carrito y retirar catálogo de esta sesión" secondary disabled={busy}
    onPress={()=>{client.clearCommerce();setBranchInput('');setMessage('Carrito borrado de la sesión.');}}/>
  </>}
  <Action label="Finalizar compra — pendiente del servidor"
   disabled hint="La confirmación y el pago requieren catálogo, stock y PSP certificados"
   onPress={()=>{}}/>
 </Panel>;
}

/** Lectura de catálogo de múltiples páginas, sin alimentar carrito ni pagos.
 * Solo aparece con una API Buyer previamente auditada por A.
 */
function ReadOnlyCatalogPager({client,view}:{client:ClientExperience;view:ClientSnapshot}){
 const pager=view.commercePager;
 const [branchInput,setBranchInput]=useState('');
 const [message,setMessage]=useState('');
 if(!pager.readReady)return null;
 const load=async(next=false,previous=false)=>{
  const input=(next||previous)?pager.branchId:branchInput;
  const validated=prepareCatalogBranchLookup(input??'');
  if(!validated.ok){setMessage('Ingresá un identificador válido de sucursal.');return;}
  setMessage('');
  const result=await client.loadCommercePage({branchId:validated.branchId,next,previous});
  if(!result.ok)setMessage('No se pudo validar esta página del catálogo. Actualizá desde el inicio.');
 };
 return <Panel>
  <Text accessibilityRole="header" style={styles.heading}>Explorar catálogo paginado · solo lectura</Text>
  <Text style={styles.small}>Esta exploración no agrega artículos al carrito, no reserva stock ni confirma pedidos. Las cantidades totales de la plataforma son desconocidas.</Text>
  <TextInput style={styles.field} value={branchInput}
   onChangeText={v=>{setBranchInput(v);setMessage('');}}
   editable={!pager.loading} maxLength={36} autoCapitalize="none" autoCorrect={false}
   placeholder="Identificador de sucursal" accessibilityLabel="Sucursal de catálogo paginado"/>
  <Action label={pager.loading?'Consultando página…':'Explorar sucursal'}
   busy={pager.loading} disabled={pager.loading} onPress={()=>void load()}/>
  {pager.error&&<Text accessibilityRole="alert" style={styles.text}>La página no cumple el contrato del servidor. No se muestran artículos antiguos.</Text>}
  {message!==''&&<Text accessibilityRole="alert" style={styles.text}>{message}</Text>}
  {pager.loading&&<Text accessibilityLiveRegion="polite" style={styles.text}>Comprobando precios y stock. Se oculta la página anterior.</Text>}
  {!pager.loading&&pager.pageNumber>0&&<>
   <Text style={styles.small}>Página {pager.pageNumber} · {pager.visibleItems.length} productos en esta página, no el total de la plataforma. Versión {pager.version}.</Text>
   {pager.visibleItems.filter(item=>item.active).map(item=><View key={item.itemId} style={styles.card}>
    <Text style={styles.heading}>{item.itemTag.replaceAll('_',' ')}</Text>
    <Text style={styles.text}>{item.itemClass==='PHARMACY_OTC'?'Artículo de farmacia sin receta':'Artículo general'} · {item.unitPricePyg.toLocaleString('es-PY')} Gs. · Stock reportado: {item.stockUnits}</Text>
    <Text style={styles.small}>Solo consulta. El precio final y la compra requieren una transacción de servidor.</Text>
   </View>)}
   <Action label="Página anterior" secondary disabled={!pager.hasPrevious}
    onPress={()=>void load(false,true)}/>
   <Action label="Página siguiente" secondary disabled={!pager.hasNext}
    onPress={()=>void load(true,false)}/>
   <Action label="Cerrar exploración" secondary onPress={()=>{client.clearCommercePage();setMessage('');}}/>
  </>}
  <Text style={styles.small}>No hay límite global de registros de catálogo en el navegador; cada solicitud recibe solo una página. La compra multi-página necesita contrato atómico de A.</Text>
 </Panel>;
}
