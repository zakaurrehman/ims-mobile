import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { type } from '../../theme/typography';
import { radius, space } from '../../theme/spacing';

function GeometricIllustration({ accentColor }) {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="44" fill="none" stroke={accentColor} strokeWidth="1.5" opacity="0.2" />
      <Circle cx="60" cy="60" r="30" fill="none" stroke={accentColor} strokeWidth="1" opacity="0.15" />
      <Circle cx="60" cy="60" r="10" fill={accentColor} opacity="0.2" />
      {/* Cardinal spokes */}
      <Line x1="16" y1="60" x2="30" y2="60" stroke={accentColor} strokeWidth="1.5" opacity="0.25" />
      <Line x1="90" y1="60" x2="104" y2="60" stroke={accentColor} strokeWidth="1.5" opacity="0.25" />
      <Line x1="60" y1="16" x2="60" y2="30" stroke={accentColor} strokeWidth="1.5" opacity="0.25" />
      <Line x1="60" y1="90" x2="60" y2="104" stroke={accentColor} strokeWidth="1.5" opacity="0.25" />
      {/* Endpoint dots */}
      <Circle cx="16" cy="60" r="3" fill={accentColor} opacity="0.3" />
      <Circle cx="104" cy="60" r="3" fill={accentColor} opacity="0.3" />
      <Circle cx="60" cy="16" r="3" fill={accentColor} opacity="0.3" />
      <Circle cx="60" cy="104" r="3" fill={accentColor} opacity="0.3" />
      {/* Diagonal accents */}
      <Line x1="29" y1="29" x2="38" y2="38" stroke={accentColor} strokeWidth="1" opacity="0.15" />
      <Line x1="82" y1="82" x2="91" y2="91" stroke={accentColor} strokeWidth="1" opacity="0.15" />
      <Line x1="91" y1="29" x2="82" y2="38" stroke={accentColor} strokeWidth="1" opacity="0.15" />
      <Line x1="29" y1="91" x2="38" y2="82" stroke={accentColor} strokeWidth="1" opacity="0.15" />
    </Svg>
  );
}

export default function EmptyState({
  title = 'Nothing here yet',
  subtitle,
  action,
  onAction,
  accentColor = colors.accent,
}) {
  return (
    <View style={styles.wrap}>
      <GeometricIllustration accentColor={accentColor} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: accentColor }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: space.md,
  },
  title: {
    ...type.heading,
    textAlign: 'center',
    marginTop: space.sm,
  },
  subtitle: {
    ...type.bodyMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.xl,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
