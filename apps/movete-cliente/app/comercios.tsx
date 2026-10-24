import React,{useEffect,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import type {ClientExperience,ClientSnapshot} from '../src/domain/client-experience.mjs';
import {prepareCatalogBranchLookup,isSelectedCatalogBranchCurrent} from '../src/domain/catalog-branch-lookup.mjs';
import {COMMERCE_VERTICALS,selectCommerceVertical,filterVerifiedCatalogPage,
 filterVerifiedBranchPage} from '../src/domain/commerce-storefront.mjs';
import type {CommerceVertical} from '../src/domain/commerce-storefront.mjs';
export default function Commerce(){
 const {client,view}=useClientView();
 // El key elimina búsqueda, rubro elegido y sucursal anterior ANTES de
 // mostrar una cuenta nueva, incluso con subject igual y JWT rotado.
 return <PrivateCommerce key={view.privateViewRevision} client={client} view={view}/>;
}
function PrivateCommerce({client,view}:{client:ClientExperience;view:ClientSnapshot}){
 const [preferredBranch,setPreferredBranch]=useState<string|null>(null);
 const [selectedVertical,setSelectedVertical]=useState<CommerceVertical>('SUPERMARKET');
 const [query,setQuery]=useState('');
 const selected=selectCommerceVertical(selectedVertical);
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>Tiendas y entregas</Text>
   <Text style={styles.heroSub}>Supermercados, farmacias sin receta, restaurantes y más. Solo se muestran productos, stock y precios confirmados por servidor.</Text>
  </View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>¿Qué necesitás comprar?</Text>
   <Text style={styles.text}>Elegí el tipo de comercio</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
    {COMMERCE_VERTICALS.map(option=><View key={option.code}
     style={{width:'47%',minWidth:130}}>
     <Action label={option.label} secondary={selectedVertical!==option.code}
      selected={selectedVertical===option.code}
      onPress={()=>{setSelectedVertical(option.code);setPreferredBranch(null);}}/>
    </View>)}
   </View>
   <Text style={styles.text}>{selected?.description}</Text>
   <Text style={styles.small}>La categoría filtra solamente las sucursales de la página consultada al servidor; no verifica disponibilidad en toda la ciudad.</Text>
   <Text accessibilityRole="header" style={styles.heading}>Buscar dentro del catálogo verificado</Text>
   <TextInput style={styles.field} accessibilityLabel="Buscar productos de la sucursal verificada"
    value={query} onChangeText={setQuery} maxLength={64}
    placeholder="Ej.: leche, arroz o protector solar" autoCorrect={false}/>
   <Text style={styles.small}>La búsqueda es local sobre la página de productos autorizada. No conserva direcciones ni consultas entre sesiones.</Text>
  </Panel>
  {!view.commerce.catalogReadReady&&<Panel>
   <Text accessibilityRole="header" style={styles.heading}>Catálogo pendiente de integración</Text>
   <Text style={styles.text}>Para mostrar comercios, artículos y precios de verdad necesitamos el servicio de sucursales y catálogo autorizado por el backend.</Text>
   <Text style={styles.small}>No hay ofertas, tiempos de entrega o stock simulados. La compra y el pago continúan desactivados.</Text>
  </Panel>}
  {view.authenticated&&view.branchDirectory.readReady&&
   <CertifiedBranchDirectory client={client} view={view}
    selectedVertical={selectedVertical} onSelect={setPreferredBranch}/>}
  {view.authenticated&&view.commerce.catalogReadReady&&
   <CertifiedCatalog client={client} view={view} query={query}
    preferredBranch={preferredBranch}/>}
  {view.authenticated&&view.commercePager.readReady&&
   <ReadOnlyCatalogPager client={client} view={view} query={query}
    preferredBranch={preferredBranch}/>}
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>¿Cómo funcionará tu pedido?</Text>
   <Text style={styles.text}>Elegí un comercio habilitado, agregá productos con precio y stock vigentes, revisá el total del servidor y confirmá cuando el pago y el despacho estén certificados.</Text>
   <Text style={styles.small}>Farmacias: solo productos permitidos sin receta, según las reglas legales y de la sucursal. Moto para reparto de carga, no para pasajeros.</Text>
  </Panel>
 </ScrollView>;
}

/** No presenta productos ni precios mientras falte el GET certificado de A.
 * Los ítems mostrados proceden exclusivamente del flujo de catálogo autorizado.
 */
function CertifiedCatalog({client,view,preferredBranch,query}:{client:ClientExperience;view:ClientSnapshot;preferredBranch:string|null;query:string}){
 const commerce=view.commerce;
 const [branchInput,setBranchInput]=useState('');
 const [message,setMessage]=useState('');
 useEffect(()=>{if(preferredBranch)setBranchInput(preferredBranch);},[preferredBranch]);
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
 const fresh=commerce.stage==='SERVER_CATALOG'&&!commerce.catalogLoading
  &&isSelectedCatalogBranchCurrent(branchInput,commerce.branchId);
 const verifiedMatches=fresh?filterVerifiedCatalogPage(commerce.catalogItems,
  {query,verified:true}):null;
 const visibleItems=verifiedMatches?.ok?verifiedMatches.items:[];
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
   {verifiedMatches?.ok&&visibleItems.length===0&&<Text style={styles.small}>
    Sin coincidencias en este catálogo verificado. No significa que el artículo esté agotado en otros comercios.
   </Text>}
   {verifiedMatches&&!verifiedMatches.ok&&<Text accessibilityRole="alert" style={styles.small}>
    Búsqueda inválida o catálogo no verificable. No se muestran artículos.
   </Text>}
   {visibleItems.map(item=>{
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
function ReadOnlyCatalogPager({client,view,preferredBranch,query}:{client:ClientExperience;view:ClientSnapshot;preferredBranch:string|null;query:string}){
 const pager=view.commercePager;
 const [branchInput,setBranchInput]=useState('');
 const [message,setMessage]=useState('');
 useEffect(()=>{if(preferredBranch)setBranchInput(preferredBranch);},[preferredBranch]);
 if(!pager.readReady)return null;
 const matchingBranch=isSelectedCatalogBranchCurrent(branchInput,pager.branchId);
 const matchedCatalog=!pager.loading&&pager.pageNumber>0&&matchingBranch
  ?filterVerifiedCatalogPage(pager.visibleItems,{query,verified:true}):null;
 const visibleItems=matchedCatalog?.ok?matchedCatalog.items:[];
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
  {!pager.loading&&pager.pageNumber>0&&!matchingBranch&&<Text style={styles.text}>
   La sucursal ingresada no coincide con la última consulta. Volvé a validar para ver precios vigentes.
  </Text>}
  {!pager.loading&&pager.pageNumber>0&&matchingBranch&&<>
   <Text style={styles.small}>Página {pager.pageNumber} · {pager.visibleItems.length} productos en esta página, no el total de la plataforma. Versión {pager.version}.</Text>
   {matchedCatalog?.ok&&visibleItems.length===0&&<Text style={styles.small}>
    No hay productos coincidentes en esta página; usá los controles de paginación para seguir explorando.
   </Text>}
   {matchedCatalog&&!matchedCatalog.ok&&<Text accessibilityRole="alert" style={styles.small}>
    La búsqueda o la página no pudo verificarse.
   </Text>}
   {visibleItems.map(item=><View key={item.itemId} style={styles.card}>
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

/** Listado G44 sin disponibilidad prometida, sin pedidos ni datos personales.
 * Solo se monta con un GET de sucursales certificado; OFF por defecto.
 */
function CertifiedBranchDirectory({client,view,onSelect,selectedVertical}:{
 client:ClientExperience;view:ClientSnapshot;onSelect:(id:string)=>void;
 selectedVertical:CommerceVertical;
}){
 const directory=view.branchDirectory;
 const [municipality,setMunicipality]=useState('');
 const [service,setService]=useState<'MOTO_DELIVERY'|'AUTO_DELIVERY'>('MOTO_DELIVERY');
 const [message,setMessage]=useState('');
 const sameQuery=directory.municipality===municipality&&directory.serviceKind===service;
 const matchingCategory=!directory.loading&&directory.pageNumber>0&&sameQuery
  ?filterVerifiedBranchPage(directory.items,{vertical:selectedVertical,verified:true}):null;
 const visibleBranches=matchingCategory?.ok?matchingCategory.items:[];
 const browse=async(next=false,previous=false)=>{
  if(directory.loading)return;
  setMessage('');
  const result=await client.loadBuyerBranches({municipality,serviceKind:service,next,previous});
  if(!result.ok)setMessage('No fue posible validar esa página de sucursales. Revisá el municipio y volvé a consultar.');
 };
 if(!directory.readReady)return null;
 return <Panel>
  <Text accessibilityRole="header" style={styles.heading}>Buscar sucursales por municipio · G44</Text>
  <Text style={styles.small}>Consulta de sucursales habilitadas en el catálogo QA. Cobertura reportada no significa disponibilidad de repartidor ni autorización para realizar pedidos.</Text>
  <TextInput style={styles.field} placeholder="Municipio (por ejemplo, Asunción)"
   value={municipality} onChangeText={v=>{setMunicipality(v);setMessage('');}}
   editable={!directory.loading} maxLength={80}
   accessibilityLabel="Municipio para buscar sucursales"/>
  <Action label="Entregas en moto de carga" secondary={service!=='MOTO_DELIVERY'}
   selected={service==='MOTO_DELIVERY'} disabled={directory.loading}
   onPress={()=>{setService('MOTO_DELIVERY');setMessage('');}}/>
  <Action label="Entregas en automóvil" secondary={service!=='AUTO_DELIVERY'}
   selected={service==='AUTO_DELIVERY'} disabled={directory.loading}
   onPress={()=>{setService('AUTO_DELIVERY');setMessage('');}}/>
  <Action label={directory.loading?'Consultando sucursales…':'Consultar sucursales'}
   busy={directory.loading} disabled={directory.loading}
   onPress={()=>void browse()}/>
  {directory.loading&&<Text accessibilityLiveRegion="polite" style={styles.text}>
   Verificando en servidor los registros del municipio. Se oculta la página anterior.
  </Text>}
  {directory.error&&<Text accessibilityRole="alert" style={styles.text}>
   La página no pudo validarse; no se presentan resultados antiguos.
  </Text>}
  {message!==''&&<Text accessibilityRole="alert" style={styles.text}>{message}</Text>}
  {!directory.loading&&directory.pageNumber>0&&sameQuery&&<>
   <Text style={styles.small}>Página {directory.pageNumber} · {directory.items.length} sucursales en esta página. Total global desconocido.</Text>
   <Text style={styles.small}>Categoría: {selectCommerceVertical(selectedVertical)?.label}. El filtro aplica solo a esta página: una lista vacía no implica ausencia de comercios en la zona.</Text>
   {visibleBranches.length===0&&matchingCategory?.ok&&<Text style={styles.small}>
    Sin sucursales de esta categoría en esta página. Podés consultar las siguientes.
   </Text>}
   {visibleBranches.map(item=><View key={item.branchId} style={styles.card}>
    <Text style={styles.heading}>{item.branchTag.replaceAll('_',' ')}</Text>
    <Text style={styles.text}>{item.merchantKind} · {item.municipality}</Text>
    <Text style={styles.small}>Solo descubrimiento. Esta sucursal no está autorizada a recibir pedidos desde esta pantalla.</Text>
    <Action label={'Elegir sucursal '+item.branchTag.replaceAll('_',' ')}
     secondary onPress={()=>{onSelect(item.branchId);
      setMessage('Sucursal elegida. Consultá el catálogo para obtener precios y stock verificados.');}}/>
   </View>)}
   <Action label="Sucursales anteriores" secondary disabled={!directory.hasPrevious}
    onPress={()=>void browse(false,true)}/>
   <Action label="Siguientes sucursales" secondary disabled={!directory.hasNext}
    onPress={()=>void browse(true,false)}/>
   <Action label="Cerrar búsqueda de sucursales" secondary
    onPress={()=>{client.clearBuyerBranches();setMessage('');}}/>
  </>}
  <Text style={styles.small}>Cada respuesta contiene hasta 100 sucursales, sin limitar los registros totales. Las consultas caducan localmente a los 30 segundos; se deberá reconfirmar la disponibilidad real antes de un pedido.</Text>
 </Panel>;
}
