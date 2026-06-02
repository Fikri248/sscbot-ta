import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Dummy data for detailed conversation history
const initialConversations = [
  { id: "CONV-001", student: "Ahmad Reza", nim: "1301202301", topic: "Batas Pembayaran BPP", date: "2026-06-02 10:15" },
  { id: "CONV-002", student: "Siti Aminah", nim: "1301213402", topic: "Syarat Sidang Skripsi", date: "2026-06-02 09:30" },
  { id: "CONV-003", student: "Budi Santoso", nim: "1301194503", topic: "Kendala Cetak Transkrip", date: "2026-06-01 15:45" },
  { id: "CONV-004", student: "Dewi Lestari", nim: "1301221122", topic: "Prosedur Cuti Akademik", date: "2026-06-01 11:20" },
  { id: "CONV-005", student: "Rina Nose", nim: "1301219988", topic: "KTM Hilang", date: "2026-05-30 14:10" },
  { id: "CONV-006", student: "Joko Anwar", nim: "1301205566", topic: "Urus Surat Keterangan Mahasiswa", date: "2026-05-29 08:05" },
];

export function AdminConversations() {
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState(initialConversations);

  const filteredConversations = conversations.filter(
    (c) =>
      c.student.toLowerCase().includes(search.toLowerCase()) ||
      c.nim.includes(search) ||
      c.topic.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus riwayat percakapan ini?")) {
      setConversations(conversations.filter(c => c.id !== id));
    }
  };



  return (
    <Card className="h-full border-none shadow-none flex flex-col">
      <CardHeader className="pb-3 px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">Riwayat Percakapan</CardTitle>
            <CardDescription>Detail riwayat interaksi mahasiswa dengan SSC Dashboard.</CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari nama, NIM, atau topik..."
              className="pl-8 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-auto px-6">
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[120px]">ID Chat</TableHead>
                <TableHead className="w-[200px]">Mahasiswa</TableHead>
                <TableHead>Topik</TableHead>
                <TableHead className="w-[180px]">Waktu</TableHead>
                <TableHead className="w-[100px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConversations.length > 0 ? (
                filteredConversations.map((conv) => (
                  <TableRow key={conv.id}>
                    <TableCell className="font-medium text-muted-foreground">{conv.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{conv.student}</span>
                        <span className="text-xs text-muted-foreground">{conv.nim}</span>
                      </div>
                    </TableCell>
                    <TableCell>{conv.topic}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{conv.date}</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Lihat Detail">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" 
                          title="Hapus"
                          onClick={() => handleDelete(conv.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Tidak ada riwayat percakapan yang ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
