import { UiText as Text } from '@/components/ui';
import { ScrollView, StyleSheet } from 'react-native';

type SectionPageProps = { title: string; description: string; status: string };

export default function SectionPage({ title, description, status }: SectionPageProps) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.page}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.text}>{description}</Text>
      <Text style={styles.text}>{status}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, gap: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  text: { fontSize: 16, lineHeight: 26, color: '#333' },
});
