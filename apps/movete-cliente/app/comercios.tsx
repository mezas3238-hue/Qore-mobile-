import React,{useEffect,useMemo,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import type {ClientExperience,ClientSnapshot} from '../src/domain/client-experience.mjs';
import {prepareCatalogBranchLookup,isSelectedCatalogBranchCurrent} from '../src/domain/catalog-branch-lookup.mjs';
import {COMMERCE_VERTICALS,selectCommerceVertical,filterVerifiedCatalogPage,
 filterVerifiedBranchPage} from '../src/domain/commerce-storefront.mjs';
import type {CommerceVertical} from '../src/domain/commerce-storefront.mjs';
import {reviewCommerceBasket} from '../src/domain/commerce-checkout-review.mjs';
import {createCommerceSubstitutionDraft} from '../src/domain/commerce-substitution-draft.mjs';
import type {SubstitutionChoice} from '../src/domain/commerce-substitution-draft.mjs';
import {createCommerceUiReadFence} from '../src/domain/commerce-ui-read-fence.mjs';
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
      onPress={()=>{
       if(option.code!==selectedVertical){
        // No reutilizar precios ni carrito de un rubro ajeno mientras A
        // no certifique el tipo de comercio en el catálogo.
        client.clearCommerce();client.clearCommercePage();
        setSelectedVertical(option.code);setPreferredBranch(null);
       }
      }}/>
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
   <CertifiedBranchDirectory key={selectedVertical} client={client} view={view}
    selectedVertical={selectedVertical} onSelect={setPreferredBranch}/>}
  {view.authenticated&&view.commerce.catalogReadReady&&
   <CertifiedCatalog key={selectedVertical} client={client} view={view} query={query}
    preferredBranch={preferredBranch}/>}
  {view.authenticated&&view.commercePager.readReady&&
   <ReadOnlyCatalogPager key={selectedVertical} client={client} view={view} query={query}
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
 const [readFence]=useState(()=>createCommerceUiReadFence());
 const substitutionFlow=useMemo(()=>createCommerceSubstitutionDraft(),[]);
 useEffect(()=>()=>{readFence.dispose();},[readFence]);
 const [choiceRevision,setChoiceRevision]=useState(0);
 // El cambio de revisión fuerza una nueva proyección de elecciones en RAM.
 void choiceRevision;
 useEffect(()=>{
  if(preferredBranch){
   readFence.invalidate();substitutionFlow.clear();setBranchInput(preferredBranch);
   setMessage('');
  }
 },[preferredBranch,substitutionFlow,readFence]);
 const [loading,setLoading]=useState(false);
 const busy=commerce.catalogLoading||loading||readFence.isBusy();
 const clearMessage=()=>setMessage('');
 const load=async(branchOverride?:string)=>{
  if(busy||readFence.isBusy())return;
  const branch=prepareCatalogBranchLookup(branchOverride??branchInput);
  if(!branch.ok){setMessage('Ingresá un identificador válido de una sucursal autorizada.');return;}
  substitutionFlow.clear();
  setChoiceRevision(r=>r+1);
  setLoading(true);setMessage('');
  await readFence.run(()=>client.loadCommerceCatalog(branch.branchId),{
   onResult:result=>setMessage(result.ok
    ?'Catálogo validado por el servidor. Precio y stock sujetos a actualización.'
    :'No se pudo verificar la sucursal o el catálogo. No se conservarán precios sin validación.'),
   onError:()=>setMessage('Consulta no confirmada. Volvé a verificar la sucursal.'),
   onFinish:()=>setLoading(false)
  });
 };
 const fresh=commerce.stage==='SERVER_CATALOG'&&!commerce.catalogLoading
  &&commerce.catalogExpiresAt!==null&&commerce.catalogExpiresAt>Date.now()
  &&isSelectedCatalogBranchCurrent(branchInput,commerce.branchId);
 const verifiedMatches=fresh?filterVerifiedCatalogPage(commerce.catalogItems,
  {query,verified:true}):null;
 const visibleItems=verifiedMatches?.ok?verifiedMatches.items:[];
 const review=fresh?reviewCommerceBasket(commerce,{
  authenticated:view.authenticated,now:Date.now()
 }):null;
 const actor={authenticated:view.authenticated,subject:view.account?.subject??null,
  sessionRevision:view.privateViewRevision};
 const preferences=substitutionFlow.snapshot(commerce,actor);
 const summary=review?.ok
  ?review.estimatedSubtotalPyg.toLocaleString('es-PY')+' Gs.':'—';
 const edit=(id:string,quantity:number)=>{
  client.setCommerceQuantity(id,quantity);
  setChoiceRevision(r=>r+1);
 };
 const chooseSubstitution=(itemId:string,choice:SubstitutionChoice|null)=>{
  const result=substitutionFlow.choose(commerce,actor,{itemId,choice});
  if(!result.ok)setMessage('El carrito cambió o venció. Revisá el catálogo antes de elegir.');
  setChoiceRevision(r=>r+1);
 };
 return <Panel>
  <Text accessibilityRole="header" style={styles.heading}>Carrito del catálogo autorizado</Text>
  <Text style={styles.small}>Esta vista solo usa catálogo versionado y vigente de una sucursal autorizada. No representa reserva de stock, tarifa de envío, pago ni pedido confirmado.</Text>
  <Text style={styles.text}>Código de sucursal autorizada</Text>
  <TextInput style={styles.field} autoCapitalize="none" autoCorrect={false}
   value={branchInput} onChangeText={value=>{
    readFence.invalidate();substitutionFlow.clear();setBranchInput(value);clearMessage();
   }}
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
   <Text accessibilityRole="header" style={styles.heading}>Revisión de tu carrito</Text>
   {!review?.ok&&<Text style={styles.small}>
    Agregá artículos disponibles para consultar un subtotal estimado; todavía no es un pedido ni una reserva.
   </Text>}
   {review?.ok&&<View>
    <Text style={styles.small}>Sucursal verificada · Versión {review.catalogVersion} ·
     Reparto preferido: {review.vehicleKind==='MOTO'?'moto de carga':'automóvil de carga'}</Text>
    {review.lines.map(line=><View key={line.itemId} style={styles.row}>
     <Text style={styles.text}>
      {line.quantity} × {line.itemTag.replaceAll('_',' ')}
     </Text>
     <Text style={styles.text}>
      {line.lineSubtotalPyg.toLocaleString('es-PY')} Gs.
     </Text>
    </View>)}
    {preferences.ok&&<View style={{gap:8}}>
     <Text accessibilityRole="header" style={styles.heading}>
      Si falta algún producto · decisiones locales
     </Text>
     <Text style={styles.small}>
      Estas preferencias solo están en este dispositivo durante la sesión.
      No se envían al comercio, al repartidor ni al servidor; no autorizan reemplazos automáticos.
     </Text>
     {preferences.choices.map(choice=><View key={choice.itemId} style={styles.card}>
      <Text style={styles.text}>{choice.itemTag.replaceAll('_',' ')}</Text>
      <Action secondary={choice.choice!=='OMIT_IF_UNAVAILABLE'}
       selected={choice.choice==='OMIT_IF_UNAVAILABLE'}
       label="Si falta: quitar este producto (borrador)"
       onPress={()=>chooseSubstitution(choice.itemId,'OMIT_IF_UNAVAILABLE')}/>
      <Action secondary={choice.choice!=='ASK_BEFORE_SUBSTITUTING'}
       selected={choice.choice==='ASK_BEFORE_SUBSTITUTING'}
       label="Si falta: consultar antes de cambiarlo (borrador)"
       onPress={()=>chooseSubstitution(choice.itemId,'ASK_BEFORE_SUBSTITUTING')}/>
      <Action secondary selected={choice.choice===null}
       label="Sin preferencia: no autorizar sustitución"
       onPress={()=>chooseSubstitution(choice.itemId,null)}/>
     </View>)}
    </View>}
   </View>}
   <Text accessibilityRole="header" style={styles.heading}>
    Subtotal informativo: {summary}
   </Text>
   <Text style={styles.small}>
    Costo de entrega: pendiente del servidor. Descuentos: no confirmados.
    Total final: pendiente. No incluye cobro, reserva de stock ni confirmación de pedido.
   </Text>
   <Action label="Vaciar carrito y retirar catálogo de esta sesión" secondary disabled={busy}
    onPress={()=>{
     substitutionFlow.clear();setChoiceRevision(r=>r+1);
     client.clearCommerce();setBranchInput('');
     setMessage('Carrito borrado de la sesión, incluidas las preferencias.');
    }}/>
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
 const [readFence]=useState(()=>createCommerceUiReadFence());
 useEffect(()=>()=>{readFence.dispose();},[readFence]);
 useEffect(()=>{if(preferredBranch){
  readFence.invalidate();setBranchInput(preferredBranch);setMessage('');
 }},[preferredBranch,readFence]);
 if(!pager.readReady)return null;
 const matchingBranch=isSelectedCatalogBranchCurrent(branchInput,pager.branchId);
 const matchedCatalog=!pager.loading&&pager.pageNumber>0&&matchingBranch
  ?filterVerifiedCatalogPage(pager.visibleItems,{query,verified:true}):null;
 const visibleItems=matchedCatalog?.ok?matchedCatalog.items:[];
 const load=async(next=false,previous=false)=>{
  if(pager.loading||readFence.isBusy())return;
  const input=(next||previous)?pager.branchId:branchInput;
  const validated=prepareCatalogBranchLookup(input??'');
  if(!validated.ok){setMessage('Ingresá un identificador válido de sucursal.');return;}
  setMessage('');
  await readFence.run(()=>client.loadCommercePage({branchId:validated.branchId,next,previous}),{
   onResult:result=>{if(!result.ok)
    setMessage('No se pudo validar esta página del catálogo. Actualizá desde el inicio.');},
   onError:()=>setMessage('Consulta no confirmada. Volvé a comenzar la exploración.')
  });
 };
 return <Panel>
  <Text accessibilityRole="header" style={styles.heading}>Explorar catálogo paginado · solo lectura</Text>
  <Text style={styles.small}>Esta exploración no agrega artículos al carrito, no reserva stock ni confirma pedidos. Las cantidades totales de la plataforma son desconocidas.</Text>
  <TextInput style={styles.field} value={branchInput}
   onChangeText={v=>{readFence.invalidate();setBranchInput(v);setMessage('');}}
   editable={!pager.loading&&!readFence.isBusy()} maxLength={36} autoCapitalize="none" autoCorrect={false}
   placeholder="Identificador de sucursal" accessibilityLabel="Sucursal de catálogo paginado"/>
  <Action label={pager.loading||readFence.isBusy()?'Consultando página…':'Explorar sucursal'}
   busy={pager.loading||readFence.isBusy()} disabled={pager.loading||readFence.isBusy()}
   onPress={()=>void load()}/>
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
   <Action label="Página anterior" secondary
    disabled={!pager.hasPrevious||pager.loading||readFence.isBusy()}
    onPress={()=>void load(false,true)}/>
   <Action label="Página siguiente" secondary
    disabled={!pager.hasNext||pager.loading||readFence.isBusy()}
    onPress={()=>void load(true,false)}/>
   <Action label="Cerrar exploración" secondary
    disabled={pager.loading||readFence.isBusy()}
    onPress={()=>{readFence.invalidate();client.clearCommercePage();setMessage('');}}/>
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
 const [readFence]=useState(()=>createCommerceUiReadFence());
 useEffect(()=>()=>{readFence.dispose();},[readFence]);
 const sameQuery=directory.municipality===municipality&&directory.serviceKind===service;
 const matchingCategory=!directory.loading&&directory.pageNumber>0&&sameQuery
  ?filterVerifiedBranchPage(directory.items,{vertical:selectedVertical,verified:true}):null;
 const visibleBranches=matchingCategory?.ok?matchingCategory.items:[];
 const browse=async(next=false,previous=false)=>{
  if(directory.loading||readFence.isBusy())return;
  setMessage('');
  await readFence.run(()=>client.loadBuyerBranches({municipality,serviceKind:service,next,previous}),{
   onResult:result=>{if(!result.ok)
    setMessage('No fue posible validar esa página de sucursales. Revisá el municipio y volvé a consultar.');},
   onError:()=>setMessage('Consulta no confirmada. Volvé a verificar el municipio.')
  });
 };
 if(!directory.readReady)return null;
 return <Panel>
  <Text accessibilityRole="header" style={styles.heading}>Buscar sucursales por municipio · G44</Text>
  <Text style={styles.small}>Consulta de sucursales habilitadas en el catálogo QA. Cobertura reportada no significa disponibilidad de repartidor ni autorización para realizar pedidos.</Text>
  <TextInput style={styles.field} placeholder="Municipio (por ejemplo, Asunción)"
   value={municipality} onChangeText={v=>{
    readFence.invalidate();setMunicipality(v);setMessage('');
   }}
   editable={!directory.loading&&!readFence.isBusy()} maxLength={80}
   accessibilityLabel="Municipio para buscar sucursales"/>
  <Action label="Entregas en moto de carga" secondary={service!=='MOTO_DELIVERY'}
   selected={service==='MOTO_DELIVERY'} disabled={directory.loading||readFence.isBusy()}
   onPress={()=>{readFence.invalidate();setService('MOTO_DELIVERY');setMessage('');}}/>
  <Action label="Entregas en automóvil" secondary={service!=='AUTO_DELIVERY'}
   selected={service==='AUTO_DELIVERY'} disabled={directory.loading||readFence.isBusy()}
   onPress={()=>{readFence.invalidate();setService('AUTO_DELIVERY');setMessage('');}}/>
  <Action label={directory.loading||readFence.isBusy()?'Consultando sucursales…':'Consultar sucursales'}
   busy={directory.loading||readFence.isBusy()}
   disabled={directory.loading||readFence.isBusy()}
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
   <Action label="Sucursales anteriores" secondary
    disabled={!directory.hasPrevious||directory.loading||readFence.isBusy()}
    onPress={()=>void browse(false,true)}/>
   <Action label="Siguientes sucursales" secondary
    disabled={!directory.hasNext||directory.loading||readFence.isBusy()}
    onPress={()=>void browse(true,false)}/>
   <Action label="Cerrar búsqueda de sucursales" secondary
    disabled={directory.loading||readFence.isBusy()}
    onPress={()=>{readFence.invalidate();client.clearBuyerBranches();setMessage('');}}/>
  </>}
  <Text style={styles.small}>Cada respuesta contiene hasta 100 sucursales, sin limitar los registros totales. Las consultas caducan localmente a los 30 segundos; se deberá reconfirmar la disponibilidad real antes de un pedido.</Text>
 </Panel>;
}
