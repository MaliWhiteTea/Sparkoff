import { router, usePage } from '@inertiajs/react';

type Option = { value: string; label: string };

export default function ListSort({ sort, direction, options, sortKey = 'sort', directionKey = 'direction', label = 'Sıralama' }: { sort: string; direction: string; options: Option[]; sortKey?: string; directionKey?: string; label?: string }) {
    const page = usePage();
    const change = (key: string, value: string) => {
        const [path, query = ''] = page.url.split('?');
        const params = Object.fromEntries(new URLSearchParams(query));
        router.get(path, { ...params, [key]: value }, { preserveState: true, preserveScroll: true, replace: true });
    };

    return <div className="list-sort" role="group" aria-label={label}>
        <label><span>Sırala</span><select value={sort} onChange={(event) => change(sortKey, event.target.value)}>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <label><span>Yön</span><select value={direction} onChange={(event) => change(directionKey, event.target.value)}><option value="asc">Artan</option><option value="desc">Azalan</option></select></label>
    </div>;
}
