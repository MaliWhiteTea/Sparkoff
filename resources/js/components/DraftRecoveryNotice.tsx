type Props = {
    updatedAt: string;
    onRestore: () => void;
    onDiscard: () => void;
};

export default function DraftRecoveryNotice({ updatedAt, onRestore, onDiscard }: Props) {
    const date = new Intl.DateTimeFormat('tr-TR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(updatedAt));

    return <section className="admin-draft-notice" role="status">
        <div>
            <strong>Kaydedilmemiş taslak bulundu</strong>
            <span>Son kayıt: {date}. Taslak yalnızca bu tarayıcıdaki hesabınıza aittir.</span>
        </div>
        <div>
            <button type="button" className="secondary" onClick={onDiscard}>Taslağı sil</button>
            <button type="button" onClick={onRestore}>Taslağı geri yükle</button>
        </div>
    </section>;
}
