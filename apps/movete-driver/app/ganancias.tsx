import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/DriverUI';

/** C #17 — no synthetic income, fake zero, or locally estimated driver payout.
 * Backend A does not yet expose an Owner-audited Driver ledger read receipt.
 * Do not substitute an offer amount, customer fare or delivered QA status.
 */
export default function DriverEarnings(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Mis ganancias</Text>
   <Text style={styles.heroSub}>Tus liquidaciones deben verificarse con el
    libro contable del servidor. Esta sesión sigue en STAGING.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Saldo no verificado</Text>
   <Text accessibilityRole="alert" style={styles.text}>
    Sin consulta de ganancias certificada. No significa que tengas Gs. 0;
    el saldo, las comisiones y los pagos todavía no están disponibles.
   </Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mis viajes y entregas</Text>
   <Text style={styles.text}>Ganancias de AUTO, MOTO, envíos por AUTO/MOTO
    y repartos de comercios deberán aparecer aquí únicamente cuando
    el backend confirme la misma ID de servicio, el conductor asignado
    y el asiento conciliado en guaraníes (PYG).</Text>
   <Text style={styles.small}>Una oferta aceptada, una custodia completada
    o un precio cotizado no prueban un cobro ni una liquidación.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Retenciones y comisiones</Text>
   <Text style={styles.text}>Los porcentajes los configura el propietario
    desde Admin Web. La aplicación Driver no modifica porcentajes,
    no calcula importes con valores de ejemplo y no permite retiros
    ni depósitos sin un recibo persistido y autorizado.</Text>
  </Panel>
 </ScrollView>;
}
